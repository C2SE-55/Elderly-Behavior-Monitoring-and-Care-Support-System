import os
import logging
import numpy as np
from collections import defaultdict, OrderedDict, deque

try:
    import matplotlib
    import matplotlib.animation
    import matplotlib.collections
    import matplotlib.patches
    import matplotlib.pyplot as plt
except ImportError:
    matplotlib = None

from .. import core
from ..core import pipeline_config
from ..core.falldetector import lying_hint_from_keypoints

LOG = logging.getLogger(__name__)


def _bbox_overlap_ratio(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0.0:
        return 0.0
    a_area = max(1.0, (ax2 - ax1) * (ay2 - ay1))
    return inter / a_area


class AnnotationPainter:
    def __init__(self, *,
                 xy_scale=1.0,
                 keypoint_painter=None,
                 crowd_painer=None,
                 detection_painter=None):
        self.painters = {
            'Annotation': keypoint_painter or KeypointPainter(xy_scale=xy_scale),
            'AnnotationCrowd': crowd_painer or CrowdPainter(),  # TODO update
            'AnnotationDet': detection_painter or DetectionPainter(xy_scale=xy_scale),
        }

    def annotations(self, ax, annotations, ID, fps, *,
                    color=None, colors=None, texts=None, subtexts=None, yolo_boxes=None,
                    primary_annotation_index=None, restrict_fall_to_primary=False,
                    yolo_boxes_motion=None):
        fallcount = None
        by_classname = defaultdict(list)
        for ann_i, ann in enumerate(annotations):
            by_classname[ann.__class__.__name__].append((ann_i, ann))

        for classname, i_anns in by_classname.items():
            anns = [ann for _, ann in i_anns]
            this_colors = [colors[i] for i, _ in i_anns] if colors else None
            this_texts = [texts[i] for i, _ in i_anns] if texts else None
            this_subtexts = [subtexts[i] for i, _ in i_anns] if subtexts else None
            kwargs = dict(
                color=color,
                colors=this_colors,
                texts=this_texts,
                subtexts=this_subtexts,
            )
            if classname == 'Annotation':
                kwargs["yolo_boxes"] = yolo_boxes
                kwargs["annotation_source_indices"] = [i for i, _ in i_anns]
                kwargs["primary_annotation_index"] = primary_annotation_index
                kwargs["restrict_fall_to_primary"] = restrict_fall_to_primary
                kwargs["yolo_boxes_motion"] = yolo_boxes_motion
            fallcount = self.painters[classname].annotations(ax, anns, ID, fps, **kwargs)

        return fallcount


class DetectionPainter:
    def __init__(self, *, xy_scale=1.0):
        self.xy_scale = xy_scale

    def annotations(self, ax, annotations, *,
                    color=None, colors=None, texts=None, subtexts=None):
        for i, ann in reversed(list(enumerate(annotations))):
            this_color = ann.field_i
            if colors is not None:
                this_color = colors[i]
            elif color is not None:
                this_color = color
            elif hasattr(ann, 'id_'):
                this_color = ann.id_

            text = ann.category
            if texts is not None:
                text = texts[i]
            elif hasattr(ann, 'id_'):
                text = '{}'.format(ann.id_)

            subtext = None
            if subtexts is not None:
                subtext = subtexts[i]
            elif ann.score is not None:
                subtext = '{:.0%}'.format(ann.score)

            self.annotation(ax, ann, color=this_color, text=text, subtext=subtext)

    def annotation(self, ax, ann, *, color=None, text=None, subtext=None):
        if color is None:
            color = 0
        if isinstance(color, (int, np.integer)):
            color = matplotlib.cm.get_cmap('tab20')((color % 20 + 0.05) / 20)

        x, y, w, h = ann.bbox * self.xy_scale
        if w < 5.0:
            x -= 2.0
            w += 4.0
        if h < 5.0:
            y -= 2.0
            h += 4.0

        # draw box
        ax.add_patch(
            matplotlib.patches.Rectangle(
                (x, y), w, h, fill=False, color=color, linewidth=1.0))

        # draw text
        ax.annotate(
            text,
            (x, y),
            fontsize=8,
            xytext=(5.0, 5.0),
            textcoords='offset points',
            color='white', bbox={'facecolor': color, 'alpha': 0.5, 'linewidth': 0},
        )
        if subtext is not None:
            ax.annotate(
                subtext,
                (x, y),
                fontsize=5,
                xytext=(5.0, 18.0 + 3.0),
                textcoords='offset points',
                color='white', bbox={'facecolor': color, 'alpha': 0.5, 'linewidth': 0},
            )


class CrowdPainter:
    def __init__(self, *, alpha=0.5, color='orange'):
        self.alpha = alpha
        self.color = color

    def draw(self, ax, outlines):
        for outline in outlines:
            assert outline.shape[1] == 2

        patches = []
        for outline in outlines:
            polygon = matplotlib.patches.Polygon(
                outline[:, :2], color=self.color, facecolor=self.color, alpha=self.alpha)
            patches.append(polygon)
        ax.add_collection(matplotlib.collections.PatchCollection(patches, match_original=True))


class KeypointPainter:
    # Luôn vẽ một khung hình chữ nhật bọc trọn người: đứng = đứng, nằm = nằm (để thấy rõ và đếm té)
    show_box = True
    show_joint_confidences = False
    show_joint_scales = False
    show_decoding_order = False
    show_frontier_order = False
    show_only_decoded_connections = False

    def __init__(self, *,
                 xy_scale=1.0, highlight=None, highlight_invisible=False,
                 linewidth=2, markersize=None,
                 color_connections=False,
                 solid_threshold=0.5):
        self.xy_scale = xy_scale
        self.highlight = highlight
        self.highlight_invisible = highlight_invisible
        self.linewidth = linewidth
        self.markersize = markersize
        if self.markersize is None:
            if color_connections:
                self.markersize = max(1, int(linewidth * 0.5))
            else:
                self.markersize = max(linewidth + 1, int(linewidth * 3.0))
        self.color_connections = color_connections
        self.solid_threshold = solid_threshold

        LOG.debug('color connections = %s, lw = %d, marker = %d',
                  self.color_connections, self.linewidth, self.markersize)
        
        self.framecount = 0
        self.fallcount = 0
        self.centroid = -1
        self._last_fallback_fall_frame = -999  # fallback: đếm té trực tiếp từ bbox (khi tracker bỏ lỡ)
        self._FALLBACK_COOLDOWN = pipeline_config.FALL_FALLBACK_COOLDOWN_FRAMES
        self._confirm_frames = pipeline_config.FALL_CONFIRM_FRAMES
        self._global_cooldown = pipeline_config.FALL_GLOBAL_COOLDOWN_FRAMES
        self._fall_streak = defaultdict(int)
        self._last_global_fall_frame = -999
        self._fb1_streak = 0  # fallback keypoint: cần nhiều frame liên tiếp, tránh FP khi cúi/người thưa kp

        self.ct = core.CentroidTracker()
        self.falls = core.FallDetector()

        self.persons = OrderedDict()
        self.fallen = OrderedDict()
        self.prev_fallen = OrderedDict()
        _mh = pipeline_config.FALL_YOLO_MOTION_HISTORY_FRAMES
        self._yolo_cy_norm = deque(maxlen=_mh)
        self._upright_flag_history = deque(maxlen=_mh)

    def _append_fall_motion_context(self, yolo_boxes, filtered_annotations, frame_height):
        """Lưu tâm Y (YOLO) + cờ ‘đứng’ để fallback YOLO chỉ bắt sau cú rơi / từng upright."""
        fh = float(frame_height) if frame_height and frame_height > 0 else None
        if fh and yolo_boxes:
            bx = max(
                yolo_boxes,
                key=lambda b: max(0.0, float(b[2] - b[0]) * float(b[3] - b[1])),
            )
            cy = 0.5 * (float(bx[1]) + float(bx[3]))
            cy_n = cy / fh
            # Không nhét cùng một cy liên tục (YOLO mỗi N frame) — nếu không max-min = 0, không thấy cú rơi
            if not self._yolo_cy_norm or abs(float(self._yolo_cy_norm[-1]) - cy_n) > 0.003:
                self._yolo_cy_norm.append(cy_n)
        upright = False
        ur = pipeline_config.FALL_UPRIGHT_BBOX_RATIO
        for ann in filtered_annotations:
            xa, ya, wa, ha = ann.bbox()
            if lying_hint_from_keypoints(ann.data):
                continue
            if ha >= ur * max(wa, 1e-6):
                upright = True
                break
        if not upright and yolo_boxes:
            for b in yolo_boxes:
                w_ = float(b[2] - b[0])
                h_ = float(b[3] - b[1])
                if h_ >= 0.9 * max(w_, 1e-6):
                    upright = True
                    break
        self._upright_flag_history.append(1 if upright else 0)

    def _yolo_drop_supports_fall(self):
        if not pipeline_config.FALL_YOLO_REQUIRE_DROP:
            return True
        if len(self._yolo_cy_norm) < 6:
            return False
        ys = list(self._yolo_cy_norm)
        return (max(ys) - min(ys)) >= pipeline_config.FALL_YOLO_DROP_CY_NORM

    def _yolo_upright_context_ok(self):
        if not pipeline_config.FALL_YOLO_REQUIRE_UPRIGHT:
            return True
        if len(self._upright_flag_history) < 5:
            return True
        return sum(self._upright_flag_history) >= 1

    def _draw_skeleton(self, ax, x, y, v, x_, y_, w_, h_, *, skeleton, color=None, **kwargs):
        if not np.any(v > 0):
            return

        if x[5] != 0 and x[6] == 0:
            mid_x = x[5]
        elif x[5] == 0 and x[6] != 0:
            mid_x = x[6]
        elif x[5] != 0 and x[6] != 0:
            mid_x = (x[5]+x[6])/2
        else:
            mid_x = 0
            
        if y[5] != 0 and y[6] == 0:
            mid_y = y[5]
        elif y[5] == 0 and y[6] != 0:
            mid_y = y[6]
        elif y[5] != 0 and y[6] != 0:
            mid_y = (y[5]+y[6])/2
        else:
            mid_y = 0
        
        if mid_x != 0 and mid_y != 0:
            self.centroid = (mid_x, mid_y, x_, y_, w_, h_)
        elif w_ > 0 and h_ > 0:
            # Khi nằm, vai thường không nhận diện được → dùng tâm bbox để vẫn track và bắt té
            self.centroid = (x_ + w_/2, y_ + h_/2, x_, y_, w_, h_)
        else:
            self.centroid = -1

        # uncomment to disable skeleton drawing
        # return
    
        # connections
        lines, line_colors, line_styles = [], [], []
        for ci, (j1i, j2i) in enumerate(np.array(skeleton) - 1):
            c = color
            if self.color_connections:
                c = matplotlib.cm.get_cmap('tab20')(ci / len(skeleton))
            if v[j1i] > 0 and v[j2i] > 0:
                lines.append([(x[j1i], y[j1i]), (x[j2i], y[j2i])])
                line_colors.append(c)
                if v[j1i] > self.solid_threshold and v[j2i] > self.solid_threshold:
                    line_styles.append('solid')
                else:
                    line_styles.append('dashed')
        if lines:
            lw = max(3.0, float(kwargs.get('linewidth', self.linewidth)))
            lc = matplotlib.collections.LineCollection(
                lines, colors=line_colors,
                linewidths=lw,
                linestyles=kwargs.get('linestyle', line_styles),
                capstyle='round',
                zorder=5,
            )
            lc.set_alpha(0.95)
            ax.add_collection(lc)

        # joints
        ms = max(self.markersize, 4)
        ax.scatter(
            x[v > 0.0], y[v > 0.0], s=ms**2, marker='o',
            color='white' if self.color_connections else color,
            edgecolors='#111111',
            linewidths=0.6,
            zorder=6,
        )

        # highlight joints
        if self.highlight is not None:
            highlight_v = np.zeros_like(v)
            highlight_v[self.highlight] = 1
            highlight_v = np.logical_and(v, highlight_v)

            ax.scatter(
                x[highlight_v], y[highlight_v], s=ms**2, marker='o',
                color='white' if self.color_connections else color,
                edgecolors='#111111',
                linewidths=0.6,
                zorder=6,
            )

    def keypoints(self, ax, keypoint_sets, *,
                  skeleton, scores=None, color=None, colors=None, texts=None):
        if keypoint_sets is None:
            return

        if color is None and colors is None:
            colors = range(len(keypoint_sets))

        for i, kps in enumerate(np.asarray(keypoint_sets)):
            assert kps.shape[1] == 3
            x = kps[:, 0] * self.xy_scale
            y = kps[:, 1] * self.xy_scale
            v = kps[:, 2]

            if colors is not None:
                color = colors[i]

            if isinstance(color, (int, np.integer)):
                color = matplotlib.cm.get_cmap('tab20')((color % 20 + 0.05) / 20)

            self._draw_skeleton(ax, x, y, v, skeleton=skeleton, color=color)
            if self.show_box:
                score = scores[i] if scores is not None else None
                self._draw_box(ax, x, y, v, color, score)

            if texts is not None:
                self._draw_text(ax, x, y, v, texts[i], color)

    @staticmethod
    def _draw_box(ax, x, y, w, h, color, score=None, linewidth=1):
        ax.add_patch(
            matplotlib.patches.Rectangle(
                (x, y), w, h, fill=False, color=color, linewidth=linewidth))

        if score:
            ax.text(x, y - linewidth, '{:.4f}'.format(score), fontsize=8, color=color)

    @staticmethod
    def _draw_text(ax, x, y, v, text, color, *, subtext=None):
        if not np.any(v > 0):
            return

        coord_i = np.argsort(y[v > 0])
        if np.sum(v) >= 2 and y[v > 0][coord_i[1]] < y[v > 0][coord_i[0]] + 10:
            # second coordinate within 10 pixels
            f0 = 0.5 + 0.5 * (y[v > 0][coord_i[1]] - y[v > 0][coord_i[0]]) / 10.0
            coord_y = f0 * y[v > 0][coord_i[0]] + (1.0 - f0) * y[v > 0][coord_i[1]]
            coord_x = f0 * x[v > 0][coord_i[0]] + (1.0 - f0) * x[v > 0][coord_i[1]]
        else:
            coord_y = y[v > 0][coord_i[0]]
            coord_x = x[v > 0][coord_i[0]]

        ax.annotate(
            text,
            (coord_x, coord_y),
            fontsize=8,
            xytext=(5.0, 5.0),
            textcoords='offset points',
            color='white', bbox={'facecolor': color, 'alpha': 0.5, 'linewidth': 0},
        )
        if subtext is not None:
            ax.annotate(
                subtext,
                (coord_x, coord_y),
                fontsize=5,
                xytext=(5.0, 18.0 + 3.0),
                textcoords='offset points',
                color='white', bbox={'facecolor': color, 'alpha': 0.5, 'linewidth': 0},
            )

    @staticmethod
    def _draw_scales(ax, xs, ys, vs, color, scales):
        for x, y, v, scale in zip(xs, ys, vs, scales):
            if v == 0.0:
                continue
            ax.add_patch(
                matplotlib.patches.Rectangle(
                    (x - scale / 2, y - scale / 2), scale, scale, fill=False, color=color))

    @staticmethod
    def _draw_joint_confidences(ax, xs, ys, vs, color):
        for x, y, v in zip(xs, ys, vs):
            if v == 0.0:
                continue
            ax.annotate(
                '{:.0%}'.format(v),
                (x, y),
                fontsize=6,
                xytext=(0.0, 0.0),
                textcoords='offset points',
                verticalalignment='top',
                color='white', bbox={'facecolor': color, 'alpha': 0.2, 'linewidth': 0, 'pad': 0.0},
            )

    @staticmethod
    def _draw_centroids(ax, ID, x, y, linewidth=1):
        ax.add_patch(
            matplotlib.patches.Circle(
                (x, y), 5, linewidth=linewidth))
        
        ax.text(x - linewidth*2, y - linewidth*2, ID, fontsize=8)
    
    @staticmethod
    def _draw_fallcount(ax, fallcount):
        ax.text(0, 0.9, "Fall Count: {}".format(fallcount), fontsize=16, color='black', transform=ax.transAxes, bbox={'facecolor': 'white', 'alpha': 0.5, 'linewidth': 0, 'pad': 0.1})
        
    def annotations(self, ax, annotations, stream, fps, *,
                    color=None, colors=None, texts=None, subtexts=None, yolo_boxes=None,
                    annotation_source_indices=None,
                    primary_annotation_index=None, restrict_fall_to_primary=False,
                    yolo_boxes_motion=None):
        centroids = []
        filtered_annotations = []
        filtered_texts = []
        filtered_source_indices = []

        if annotation_source_indices is None:
            annotation_source_indices = list(range(len(annotations)))
        elif len(annotation_source_indices) != len(annotations):
            annotation_source_indices = list(range(len(annotations)))

        use_yolo_gate = pipeline_config.POSE_USE_YOLO_GATE and bool(yolo_boxes)
        min_overlap = max(0.0, pipeline_config.POSE_YOLO_MIN_OVERLAP)
        min_score = pipeline_config.POSE_MIN_SCORE
        min_area = pipeline_config.POSE_MIN_BOX_AREA

        def _fall_eligible(global_idx):
            if not restrict_fall_to_primary:
                return True
            if primary_annotation_index is None:
                return False
            return global_idx == primary_annotation_index

        for i, ann in enumerate(annotations):
            x_, y_, w_, h_ = ann.bbox()
            if w_ < 5.0:
                x_ -= 2.0
                w_ += 4.0
            if h_ < 5.0:
                y_ -= 2.0
                h_ += 4.0

            score_val = ann.score() if hasattr(ann, "score") and ann.score() is not None else 0.0
            if score_val < min_score:
                continue
            if (w_ * h_) < min_area:
                continue
            if use_yolo_gate:
                pose_xyxy = (x_, y_, x_ + w_, y_ + h_)
                matched = any(_bbox_overlap_ratio(pose_xyxy, yb) >= min_overlap for yb in yolo_boxes)
                if not matched:
                    continue

            filtered_annotations.append(ann)
            filtered_texts.append(texts[i] if texts is not None and i < len(texts) else None)
            filtered_source_indices.append(annotation_source_indices[i])

        ylim_pre = ax.get_ylim()
        frame_height_pre = abs(ylim_pre[1] - ylim_pre[0]) if ylim_pre else None
        motion_yolo = yolo_boxes_motion if yolo_boxes_motion is not None else yolo_boxes
        ann_motion = filtered_annotations
        if restrict_fall_to_primary:
            if primary_annotation_index is None:
                ann_motion = []
            else:
                ann_motion = [
                    ann
                    for ann, gidx in zip(filtered_annotations, filtered_source_indices)
                    if gidx == primary_annotation_index
                ]
        self._append_fall_motion_context(motion_yolo, ann_motion, frame_height_pre)

        for i, ann in enumerate(filtered_annotations):
            self.centroid = -1

            color = i
            if colors is not None:
                color = colors[i]
            elif hasattr(ann, 'id_'):
                color = ann.id_

            text = None
            text_is_score = False
            if filtered_texts:
                text = filtered_texts[i]
            elif hasattr(ann, 'id_'):
                text = '{}'.format(ann.id_)
            elif ann.score():
                text = '{:.0%}'.format(ann.score())
                text_is_score = True

            subtext = None
            if subtexts is not None:
                subtext = subtexts[i]
            elif not text_is_score and ann.score():
                subtext = '{:.0%}'.format(ann.score())

            self.annotation(ax, ann, color=color, text=text, subtext=subtext)

            if self.centroid != -1 and _fall_eligible(filtered_source_indices[i]):
                centroids.append(self.centroid)
            
        self.persons = self.ct.update(centroids, fps)
        
        # for ID, (x, y, x_, y_, w_, h_) in self.persons.items():
        #     self._draw_centroids(ax, ID, x, y, color)
        
        # fall detection (chỉ đếm té khi người ở phần dưới ảnh = gần sàn)
        ylim = ax.get_ylim()
        frame_height = abs(ylim[1] - ylim[0]) if ylim else None
        y_inverted = (ylim[0] > ylim[1]) if ylim and len(ylim) == 2 else False  # matplotlib imshow thường y đảo
        self.fallen = self.falls.update(
            self.persons,
            self.framecount,
            fps,
            frame_height=frame_height,
            y_inverted=y_inverted,
            annotations=filtered_annotations,
        )
        
        for ID, (x_, y_, w_, h_) in self.fallen.items():
            self._draw_box(ax, x_, y_, w_, h_, color='red')
            
            self._fall_streak[ID] += 1
            can_emit = (self.framecount - self._last_global_fall_frame) >= self._global_cooldown
            if self._fall_streak[ID] >= self._confirm_frames and can_emit:
                self.fallcount += 1
                self._last_global_fall_frame = self.framecount
                LOG.info("FALL COUNT: %s (ID=%s)", self.fallcount, ID)

        current_fallen_ids = set(self.fallen.keys())
        for fallen_id in list(self._fall_streak.keys()):
            if fallen_id not in current_fallen_ids:
                self._fall_streak[fallen_id] = 0

        self.prev_fallen = self.fallen

        # Fallback 1: keypoint lying_hint + bbox nằm ngang rõ + streak — tránh spam khi FALL_REQUIRE_FLOOR=0
        hint_strong = False
        for ann, gidx in zip(filtered_annotations, filtered_source_indices):
            if restrict_fall_to_primary and not _fall_eligible(gidx):
                continue
            if not lying_hint_from_keypoints(ann.data):
                continue
            xa, ya, wa, ha = ann.bbox()
            if wa < 5:
                wa += 4.0
            if ha < 5:
                ha += 4.0
            if ha <= 1e-6 or wa * ha <= 200:
                continue
            if wa < pipeline_config.FALL_CLEARLY_LYING_ASPECT * ha:
                continue
            hint_strong = True
            break
        if hint_strong:
            self._fb1_streak += 1
        else:
            self._fb1_streak = 0

        if (
            len(self.fallen) == 0
            and self._fb1_streak >= pipeline_config.FALL_FB1_MIN_STREAK
            and self.framecount - self._last_fallback_fall_frame >= self._FALLBACK_COOLDOWN
        ):
            for ann, gidx in zip(filtered_annotations, filtered_source_indices):
                if restrict_fall_to_primary and not _fall_eligible(gidx):
                    continue
                if not lying_hint_from_keypoints(ann.data):
                    continue
                x_, y_, w_, h_ = ann.bbox()
                if w_ < 5:
                    w_ = w_ + 4
                if h_ < 5:
                    h_ = h_ + 4
                if h_ <= 1e-6 or w_ * h_ <= 200:
                    continue
                if w_ < pipeline_config.FALL_CLEARLY_LYING_ASPECT * h_:
                    continue
                on_floor = True
                if pipeline_config.FALL_REQUIRE_FLOOR and frame_height is not None and frame_height > 0:
                    center_y = y_ + h_ / 2.0
                    if y_inverted:
                        on_floor = center_y <= (1.0 - pipeline_config.FALL_FLOOR_Y_RATIO) * frame_height
                    else:
                        on_floor = center_y >= pipeline_config.FALL_FLOOR_Y_RATIO * frame_height
                if on_floor:
                    self.fallcount += 1
                    self._last_fallback_fall_frame = self.framecount
                    self._fb1_streak = 0
                    LOG.info("FALL COUNT (fallback keypoint+bbox): {}".format(self.fallcount))
                    break
        
        # Fallback 2: pose mất track — YOLO bbox nằm ngang + có cú rơi + từng thấy upright (tránh đếm vì khung to)
        yolo_fb_boxes = motion_yolo if motion_yolo is not None else yolo_boxes
        if (
            pipeline_config.FALL_USE_YOLO_FALLBACK
            and len(self.fallen) == 0
            and yolo_fb_boxes
            and self.framecount - self._last_fallback_fall_frame >= self._FALLBACK_COOLDOWN
            and self._yolo_drop_supports_fall()
            and self._yolo_upright_context_ok()
        ):
            for (x1, y1, x2, y2) in yolo_fb_boxes:
                w_ = max(0.0, float(x2 - x1))
                h_ = max(0.0, float(y2 - y1))
                if h_ <= 1e-6:
                    continue
                if w_ < pipeline_config.FALL_YOLO_LYING_ASPECT * h_:
                    continue
                on_floor = True
                if pipeline_config.FALL_REQUIRE_FLOOR and frame_height is not None and frame_height > 0:
                    center_y = float(y1) + h_ / 2.0
                    if y_inverted:
                        on_floor = center_y <= (1.0 - pipeline_config.FALL_FLOOR_Y_RATIO) * frame_height
                    else:
                        on_floor = center_y >= pipeline_config.FALL_FLOOR_Y_RATIO * frame_height
                if on_floor:
                    self.fallcount += 1
                    self._last_fallback_fall_frame = self.framecount
                    LOG.info("FALL COUNT (yolo fallback): %s", self.fallcount)
                    break

        self.framecount += 1

        return self.fallcount

    def annotation(self, ax, ann, *, color=None, text=None, subtext=None):
        if color is None:
            color = 0
        if isinstance(color, (int, np.integer)):
            color = matplotlib.cm.get_cmap('tab20')((color % 20 + 0.05) / 20)

        kps = ann.data
        assert kps.shape[1] == 3
        x = kps[:, 0] * self.xy_scale
        y = kps[:, 1] * self.xy_scale
        v = kps[:, 2]

        if self.show_frontier_order:
            frontier = set((s, e) for s, e in ann.frontier_order)
            frontier_skeleton_mask = [
                (s - 1, e - 1) in frontier or (e - 1, s - 1) in frontier
                for s, e in ann.skeleton
            ]
            frontier_skeleton = [se for se, m in zip(ann.skeleton, frontier_skeleton_mask) if m]
            self._draw_skeleton(ax, x, y, v, color='black', skeleton=frontier_skeleton,
                                linestyle='dotted', linewidth=1)

        skeleton = ann.skeleton
        if self.show_only_decoded_connections:
            decoded_connections = set((jsi, jti) for jsi, jti, _, __ in ann.decoding_order)
            skeleton_mask = [
                (s - 1, e - 1) in decoded_connections or (e - 1, s - 1) in decoded_connections
                for s, e in skeleton
            ]
            skeleton = [se for se, m in zip(skeleton, skeleton_mask) if m]

        x_, y_, w_, h_ = ann.bbox()
            
        if w_ < 5.0:
            x_ -= 2.0
            w_ += 4.0
        if h_ < 5.0:
            y_ -= 2.0
            h_ += 4.0

        # Không nới bbox (expand 1.0) để tránh bắt sai: đứng thì h_>w_, nằm thì w_>h_ rõ ràng
        self.subject_width = w_
        self.subject_height = h_

        self._draw_skeleton(ax, x, y, v, x_, y_, w_, h_, color=color, skeleton=skeleton)
        # Mất keypoint khi nằm: vẫn track theo bbox pose để FallDetector không mất người
        if self.centroid == -1 and w_ > 0 and h_ > 0:
            self.centroid = (x_ + w_ / 2.0, y_ + h_ / 2.0, x_, y_, w_, h_)

        if self.show_joint_scales and ann.joint_scales is not None:
            self._draw_scales(ax, x, y, v, color, ann.joint_scales)

        if self.show_joint_confidences:
            self._draw_joint_confidences(ax, x, y, v, color)

        if self.show_box:
            lying_bbox = h_ > 1e-6 and w_ >= pipeline_config.FALL_LYING_ASPECT * h_
            box_color = 'orange' if (lying_bbox or lying_hint_from_keypoints(ann.data)) else 'green'
            self._draw_box(ax, x_, y_, w_, h_, box_color, ann.score(), linewidth=2)

        if text is not None:
            self._draw_text(ax, x, y, v, text, color, subtext=subtext)

        if self.show_decoding_order and hasattr(ann, 'decoding_order'):
            self._draw_decoding_order(ax, ann.decoding_order)

    @staticmethod
    def _draw_decoding_order(ax, decoding_order):
        for step_i, (jsi, jti, jsxyv, jtxyv) in enumerate(decoding_order):
            ax.plot([jsxyv[0], jtxyv[0]], [jsxyv[1], jtxyv[1]], '--', color='black')
            ax.text(0.5 * (jsxyv[0] + jtxyv[0]), 0.5 * (jsxyv[1] +jtxyv[1]),
                    '{}: {} -> {}'.format(step_i, jsi, jti), fontsize=8,
                    color='white', bbox={'facecolor': 'black', 'alpha': 0.5, 'linewidth': 0})