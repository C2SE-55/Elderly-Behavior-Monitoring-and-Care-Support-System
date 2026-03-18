import os
import logging
import numpy as np
from collections import defaultdict, OrderedDict

try:
    import matplotlib
    import matplotlib.animation
    import matplotlib.collections
    import matplotlib.patches
    import matplotlib.pyplot as plt
except ImportError:
    matplotlib = None

from .. import core

LOG = logging.getLogger(__name__)


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
                    color=None, colors=None, texts=None, subtexts=None):
        fallcount = None
        by_classname = defaultdict(list)
        for ann_i, ann in enumerate(annotations):
            by_classname[ann.__class__.__name__].append((ann_i, ann))

        for classname, i_anns in by_classname.items():
            anns = [ann for _, ann in i_anns]
            this_colors = [colors[i] for i, _ in i_anns] if colors else None
            this_texts = [texts[i] for i, _ in i_anns] if texts else None
            this_subtexts = [subtexts[i] for i, _ in i_anns] if subtexts else None
            fallcount = self.painters[classname].annotations(
                ax, anns, ID, fps,
                color=color, colors=this_colors, texts=this_texts, subtexts=this_subtexts)

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
        self._FALLBACK_COOLDOWN = 45  # frames giữa 2 lần đếm fallback (~1.5s)

        self.ct = core.CentroidTracker()
        self.falls = core.FallDetector()

        self.persons = OrderedDict()
        self.fallen = OrderedDict()
        self.prev_fallen = OrderedDict()

        self.imgwriter = core.ImgWriter()
    
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
        ax.add_collection(matplotlib.collections.LineCollection(
            lines, colors=line_colors,
            linewidths=kwargs.get('linewidth', self.linewidth),
            linestyles=kwargs.get('linestyle', line_styles),
            capstyle='round',
        ))

        # joints
        ax.scatter(
            x[v > 0.0], y[v > 0.0], s=self.markersize**2, marker='.',
            color='white' if self.color_connections else color,
            edgecolor='k' if self.highlight_invisible else None,
            zorder=2,
        )

        # highlight joints
        if self.highlight is not None:
            highlight_v = np.zeros_like(v)
            highlight_v[self.highlight] = 1
            highlight_v = np.logical_and(v, highlight_v)

            ax.scatter(
                x[highlight_v], y[highlight_v], s=self.markersize**2, marker='.',
                color='white' if self.color_connections else color,
                edgecolor='k' if self.highlight_invisible else None,
                zorder=2,
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
                    color=None, colors=None, texts=None, subtexts=None):
        centroids = []
        
        for i, ann in enumerate(annotations):
            self.centroid = -1
            
            color = i
            if colors is not None:
                color = colors[i]
            elif hasattr(ann, 'id_'):
                color = ann.id_

            text = None
            text_is_score = False
            if texts is not None:
                text = texts[i]
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
            
            if self.centroid != -1:
                centroids.append(self.centroid)
            
        self.persons = self.ct.update(centroids, fps)
        
        # for ID, (x, y, x_, y_, w_, h_) in self.persons.items():
        #     self._draw_centroids(ax, ID, x, y, color)
        
        # fall detection (chỉ đếm té khi người ở phần dưới ảnh = gần sàn)
        ylim = ax.get_ylim()
        frame_height = abs(ylim[1] - ylim[0]) if ylim else None
        y_inverted = (ylim[0] > ylim[1]) if ylim and len(ylim) == 2 else False  # matplotlib imshow thường y đảo
        self.fallen = self.falls.update(self.persons, self.framecount, fps, frame_height=frame_height, y_inverted=y_inverted)
        
        for ID, (x_, y_, w_, h_) in self.fallen.items():
            self._draw_box(ax, x_, y_, w_, h_, color='red')
            
            if ID not in self.prev_fallen:
                self.fallcount += 1
                LOG.info("FALL COUNT: {}".format(self.fallcount))
                self.imgwriter.write(stream, self.fallcount)

        self.prev_fallen = self.fallen

        # Fallback: khi tracker không bắt được té, nếu có bất kỳ người nào bbox nằm ngang + gần sàn → đếm 1 lần (cooldown)
        if len(self.fallen) == 0 and self.framecount - self._last_fallback_fall_frame >= self._FALLBACK_COOLDOWN:
            for ann in annotations:
                x_, y_, w_, h_ = ann.bbox()
                if w_ < 5:
                    w_ = w_ + 4
                if h_ < 5:
                    h_ = h_ + 4
                if w_ * h_ > 200 and w_ >= 1.1 * h_:
                    on_floor = True
                    if frame_height is not None and frame_height > 0:
                        center_y = y_ + h_ / 2.0
                        if y_inverted:
                            on_floor = center_y <= (1.0 - core.falldetector.FLOOR_Y_RATIO) * frame_height
                        else:
                            on_floor = center_y >= core.falldetector.FLOOR_Y_RATIO * frame_height
                    if on_floor:
                        self.fallcount += 1
                        self._last_fallback_fall_frame = self.framecount
                        LOG.info("FALL COUNT (fallback): {}".format(self.fallcount))
                        self.imgwriter.write(stream, self.fallcount)
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

        if self.show_joint_scales and ann.joint_scales is not None:
            self._draw_scales(ax, x, y, v, color, ann.joint_scales)

        if self.show_joint_confidences:
            self._draw_joint_confidences(ax, x, y, v, color)

        if self.show_box:
            # Màu khung: xanh = đứng (h>=w), cam = nằm (w>=1.1*h) — trùng logic FallDetector
            box_color = 'orange' if w_ >= 1.1 * h_ else 'green'
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