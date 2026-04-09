"""Video demo application.

Use --scale=0.2 to reduce the input image size to 20%.
Use --json-output for headless processing.

Example commands:
    python3 -m pifpaf.video --source=0  # default webcam
    python3 -m pifpaf.video --source=1  # another webcam

    # streaming source
    python3 -m pifpaf.video --source=http://127.0.0.1:8080/video

    # file system source (any valid OpenCV source)
    python3 -m pifpaf.video --source=docs/coco/000000081988.jpg

Trouble shooting:
* MacOSX: try to prefix the command with "MPLBACKEND=MACOSX".
"""


import argparse
import json
import logging
import io
import os
import sys
import time

import PIL
import torch
import torch.multiprocessing as mp

import cv2  # pylint: disable=import-error
import matplotlib.patches as mpatches
import numpy as np
from . import decoder, network, show, transforms, visualizer, __version__
from . import config, core, logger
from .core import face_recognizer, fall_event_client, pipeline_config, yolo_detector
from .core.safe_zone import (
    SafeZoneTracker,
    default_supervisor_zone,
    parse_polygon,
    point_in_polygon,
)

os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;udp"
LOG = logging.getLogger(__name__)


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        LOG.warning("Invalid %s=%r, fallback to %s", name, raw, default)
        return default


_STREAM_JPEG_KWARGS = dict(
    format="jpeg",
    dpi=pipeline_config.STREAM_JPEG_DPI,
    bbox_inches="tight",
    pad_inches=0.02,
    pil_kwargs={"quality": pipeline_config.STREAM_JPEG_QUALITY},
)


class CustomFormatter(argparse.ArgumentDefaultsHelpFormatter,
                      argparse.RawDescriptionHelpFormatter):
    pass


def _any_person_in_supervisor_zone(yolo_boxes, preds, w_img, h_img, poly_norm):
    """True nếu tâm bbox người (YOLO ưu tiên, không thì pose) nằm trong polygon."""
    if not poly_norm or len(poly_norm) < 3:
        return False
    wf = max(1.0, float(w_img))
    hf = max(1.0, float(h_img))
    for (x1, y1, x2, y2) in yolo_boxes:
        cx = ((x1 + x2) / 2.0) / wf
        cy = ((y1 + y2) / 2.0) / hf
        if point_in_polygon(cx, cy, poly_norm):
            return True
    if preds:
        for ann in preds:
            try:
                x_, y_, bw, bh = ann.bbox()
                cx = (x_ + bw / 2.0) / wf
                cy = (y_ + bh / 2.0) / hf
                if point_in_polygon(cx, cy, poly_norm):
                    return True
            except Exception:
                continue
    return False


def _any_person_in_frame(yolo_boxes, preds):
    """True nếu có ít nhất một người trong cảnh (YOLO bbox hoặc pose)."""
    if yolo_boxes:
        return True
    if preds:
        for ann in preds:
            try:
                ann.bbox()
                return True
            except Exception:
                continue
    return False


def _clip_bbox_xyxy(box, w_img, h_img):
    """Giới hạn bbox trong khung ảnh."""
    x1, y1, x2, y2 = box
    w_img = float(w_img)
    h_img = float(h_img)
    x1 = max(0.0, min(w_img - 1.0, x1))
    x2 = max(0.0, min(w_img - 1.0, x2))
    y1 = max(0.0, min(h_img - 1.0, y1))
    y2 = max(0.0, min(h_img - 1.0, y2))
    if x2 < x1:
        x1, x2 = x2, x1
    if y2 < y1:
        y1, y2 = y2, y1
    return (x1, y1, x2, y2)


def _primary_person_bbox(yolo_boxes, preds, w_img, h_img):
    """Bbox người cần theo dõi: YOLO — bbox có diện tích lớn nhất; không có thì pose tương tự."""
    best = None
    best_area = -1.0
    for (x1, y1, x2, y2) in yolo_boxes:
        area = max(0.0, float(x2 - x1)) * max(0.0, float(y2 - y1))
        if area > best_area:
            best_area = area
            best = (float(x1), float(y1), float(x2), float(y2))
    if best is not None:
        return _clip_bbox_xyxy(best, w_img, h_img)
    if preds:
        for ann in preds:
            try:
                x_, y_, bw, bh = ann.bbox()
                area = max(0.0, float(bw)) * max(0.0, float(bh))
                if area > best_area:
                    best_area = area
                    best = (float(x_), float(y_), float(x_ + bw), float(y_ + bh))
            except Exception:
                continue
    if best is None:
        return None
    return _clip_bbox_xyxy(best, w_img, h_img)


def _bbox_center_in_polygon(box, poly_norm, w_img, h_img):
    """True nếu tâm bbox nằm trong polygon chuẩn hóa."""
    if not poly_norm or len(poly_norm) < 3:
        return False
    x1, y1, x2, y2 = box
    wf = max(1.0, float(w_img))
    hf = max(1.0, float(h_img))
    cx = ((x1 + x2) / 2.0) / wf
    cy = ((y1 + y2) / 2.0) / hf
    return point_in_polygon(cx, cy, poly_norm)


def _pose_xyxy_clip(ann, w_img, h_img):
    x_, y_, bw, bh = ann.bbox()
    return _clip_bbox_xyxy((float(x_), float(y_), float(x_ + bw), float(y_ + bh)), w_img, h_img)


def _bbox_overlap_ratio_pose_yolo(pose_xyxy, ybox):
    ax1, ay1, ax2, ay2 = pose_xyxy
    bx1, by1, bx2, by2 = ybox
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


def _yolo_boxes_for_primary_pose(primary_idx, preds, yolo_boxes, w_img, h_img):
    if primary_idx is None or not preds or primary_idx >= len(preds) or not yolo_boxes:
        return []
    try:
        pose_xyxy = _pose_xyxy_clip(preds[primary_idx], w_img, h_img)
    except Exception:
        return []
    min_ol = max(0.05, pipeline_config.POSE_YOLO_MIN_OVERLAP * 0.5)
    out = [yb for yb in yolo_boxes if _bbox_overlap_ratio_pose_yolo(pose_xyxy, yb) >= min_ol]
    return out if out else []


def _primary_subject_bbox(primary_idx, preds, yolo_boxes, w_img, h_img):
    """BBox người được giám sát (pose + ưu tiên YOLO chồng lên pose)."""
    if primary_idx is None or not preds or primary_idx >= len(preds):
        return None
    pose_xyxy = _pose_xyxy_clip(preds[primary_idx], w_img, h_img)
    if yolo_boxes:
        yb_list = _yolo_boxes_for_primary_pose(primary_idx, preds, yolo_boxes, w_img, h_img)
        if yb_list:
            return max(
                yb_list,
                key=lambda b: max(0.0, float(b[2] - b[0])) * max(0.0, float(b[3] - b[1])),
            )
    return pose_xyxy


def _resolve_primary_subject(texts_to_use, preds, face_refs):
    """Trả về (pose_index, profile_id, tên) cho người khớp ảnh tham chiếu."""
    if not face_refs or not preds:
        return None, None, None
    if not texts_to_use:
        return None, None, None
    ref_by_name = {}
    for name, pid, _enc in face_refs:
        key = (name or "").strip()
        if key:
            ref_by_name[key] = (name, pid)
    for i, t in enumerate(texts_to_use):
        if t is None:
            continue
        tstrip = str(t).strip()
        if not tstrip:
            continue
        if tstrip in ref_by_name:
            name, pid = ref_by_name[tstrip]
            return i, pid, name
        if len(face_refs) == 1:
            return i, face_refs[0][1], face_refs[0][0]
    return None, None, None


def _pose_highlight_colors(preds, primary_idx):
    """Màu tab20: primary nổi bật, người khác nhạt hơn."""
    if not preds or primary_idx is None:
        return None
    secondary = 2
    primary_c = 18
    return [primary_c if i == primary_idx else secondary for i in range(len(preds))]


def cli():  # pylint: disable=too-many-statements,too-many-branches
    parser = argparse.ArgumentParser(
        prog='python3 -m openpifpaf.video',
        description=__doc__,
        formatter_class=CustomFormatter,
    )
    parser.add_argument('--version', action='version',
                        version='OpenPifPaf {version}'.format(version=__version__))

    network.cli(parser)
    # Nới decode pose mạnh hơn để giữ keypoint khi người nằm/nghiêng.
    pose_instance_threshold = _env_float("POSE_INSTANCE_THRESHOLD", 0.03)
    pose_seed_threshold = _env_float("POSE_SEED_THRESHOLD", 0.20)
    decoder.cli(
        parser,
        force_complete_pose=True,
        instance_threshold=pose_instance_threshold,
        seed_threshold=pose_seed_threshold,
    )
    show.cli(parser)
    visualizer.cli(parser)

    parser.add_argument('--source', default=None,
                        help='OpenCV source url. Integer for webcams. Supports rtmp streams.')
    parser.add_argument('--video-output', default=None, nargs='?', const=True,
                        help='video output file')
    parser.add_argument('--video-fps', default=show.AnimationFrame.video_fps, type=float)
    parser.add_argument('--show', default=False, action='store_true')
    parser.add_argument('--horizontal-flip', default=False, action='store_true')
    parser.add_argument('--no-colored-connections',
                        dest='colored_connections', default=True, action='store_false',
                        help='do not use colored connections to draw poses')
    parser.add_argument('--disable-cuda', action='store_true',
                        help='disable CUDA')
    parser.add_argument('--scale', default=1.0, type=float,
                        help='input image scale factor')
    parser.add_argument('--start-frame', type=int, default=0)
    parser.add_argument('--skip-frames', type=int, default=1,
                        help='chỉ chạy mô hình mỗi N frame (1= mọi frame, 3= 1/3 tải)')
    parser.add_argument('--max-fps', type=float, default=0,
                        help='giới hạn FPS hiển thị (0= tối đa, ví dụ 10 để bớt lag)')
    parser.add_argument('--max-frames', type=int)
    parser.add_argument('--json-output', default=None, nargs='?', const=True,
                        help='json output file')
    group = parser.add_argument_group('logging')
    group.add_argument('-q', '--quiet', default=False, action='store_true',
                       help='only show warning messages or above')
    group.add_argument('--debug', default=False, action='store_true',
                       help='print debug messages')
    args = parser.parse_args()

    args.debug_images = False

    # configure logging
    args.log_level = logging.INFO
    if args.quiet:
        args.log_level = logging.WARNING
    if args.debug:
        args.log_level = logging.DEBUG
    
    LOG = logger.Logger('openpifpaf').setup(args.log_level)

    network.configure(args)
    show.configure(args)
    visualizer.configure(args)
    show.AnimationFrame.video_fps = args.video_fps

    # check whether source is webcam index (int) or file path / URL (str)
    if args.source is not None and isinstance(args.source, str) and args.source.isdigit():
        args.source = int(args.source)

    # add args.device
    args.device = torch.device('cpu')
    if not args.disable_cuda and torch.cuda.is_available():
        args.device = torch.device('cuda')
    LOG.info('neural network device: %s', args.device)

    # standard filenames
    if args.video_output is True:
        args.video_output = os.path.dirname(__file__)+"/output/"+"output.mp4"
        if os.path.exists(args.video_output):
            os.remove(args.video_output)
    assert args.video_output is None or not os.path.exists(args.video_output)
    if args.json_output is True:
        args.json_output = '{}_output.json'.format(args.source)
        if os.path.exists(args.json_output):
            os.remove(args.json_output)
    assert args.json_output is None or not os.path.exists(args.json_output)

    return args


def processor_factory(args):
    model, _ = network.factory_from_args(args)
    model = model.to(args.device)
    processor = decoder.factory_from_args(args, model)
    return processor, model

def _configure_webcam_capture(capture):
    """Yêu cầu độ phân giải + buffer nhỏ (iVCam / webcam ảo hay mặc định 640x480 → nhòe khi scale).

    Biến môi trường: WEBCAM_WIDTH, WEBCAM_HEIGHT (mặc định 960x540, nhẹ hơn 720p). Đặt 0 để không ép.
    """
    try:
        w = int(os.environ.get("WEBCAM_WIDTH", "960"))
        h = int(os.environ.get("WEBCAM_HEIGHT", "540"))
    except ValueError:
        w, h = 960, 540
    if w > 0 and h > 0:
        capture.set(cv2.CAP_PROP_FRAME_WIDTH, float(w))
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, float(h))
    try:
        capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except Exception:
        pass
    aw = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    ah = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    LOG.info("Webcam: yêu cầu %dx%d, OpenCV thực tế: %dx%d", w, h, aw, ah)


def reconnect(capture, RTSPURL):
    capture.release()
    droppedFrames = 0
    capture = cv2.VideoCapture(RTSPURL, cv2.CAP_FFMPEG)
    
    if capture.isOpened():
        LOG.info("Reconnected to stream: " + RTSPURL)
        return (capture, True, droppedFrames)
    else:
        LOG.error("Cannot reconnect to stream: " + RTSPURL)
        time.sleep(10)
        return (capture, False, droppedFrames)

def inference(args, stream, stream_state=None):
    """Chạy inference từ video source. Nếu stream_state (dict) được truyền,
    mỗi frame sẽ được lưu dạng JPEG vào stream_state['jpeg'], kèm fallcount và fps
    để API có thể phát MJPEG và trạng thái cho Frontend."""
    if stream_state is not None:
        import matplotlib
        matplotlib.use('Agg')
    processor, model = processor_factory(args)

    keypoint_painter = show.KeypointPainter(
        color_connections=args.colored_connections,
        linewidth=6,
        markersize=max(10, int(6 * 2)),
    )
    # Mặc định tắt: bbox xanh/cam quanh pose là heuristic té, dễ nhầm viền vùng an toàn (xanh/đỏ) phía dưới
    keypoint_painter.show_box = os.environ.get("SHOW_POSE_BOX", "0").lower() in ("1", "true", "yes", "")
    annotation_painter = show.AnnotationPainter(keypoint_painter=keypoint_painter)

    animation = show.AnimationFrame(
        show=args.show and stream_state is None,
        video_output=args.video_output if stream_state is None else None,
        second_visual=args.debug or args.debug_indices,
    )
    
    (RTSPURL, ID, scale) = stream
    online = False
    
    if isinstance(RTSPURL, int):
        idx = RTSPURL if RTSPURL is not None else 0
        # Windows: CAP_DSHOW ổn định hơn với webcam USB (tránh read() luôn None → ready=false).
        if sys.platform == "win32":
            capture = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        else:
            capture = cv2.VideoCapture(idx)
    else:
        # file path or URL (rtsp, http, etc.)
        capture = cv2.VideoCapture(RTSPURL, cv2.CAP_FFMPEG)
    
    if capture.isOpened():
        online = True
        LOG.info('Loaded stream: ' + str(RTSPURL))
        if isinstance(RTSPURL, int):
            _configure_webcam_capture(capture)
    else:
        LOG.error('Cannot open stream: ' + str(RTSPURL))

    last_loop = time.time()
    output_fps = 0
    # FPS thực tế của vòng lặp (để FallDetector/tracker khớp lịch sử, tránh dùng input_fps=30 giả)
    prev_output_fps = 8.0
    droppedFrames = 0
    old_fallcount = 0
    last_preds = []
    last_face_texts = None
    face_refs = face_recognizer.load_face_references()
    if not face_refs:
        LOG.warning("Nhận diện khuôn mặt tắt: không có ảnh tham chiếu. Kiểm tra Backend (GET /api/health-metrics/face-references) và đăng ảnh đại diện trong Quản lý thông tin sức khỏe.")
    else:
        LOG.info("Đã tải %d ảnh tham chiếu cho nhận diện khuôn mặt.", len(face_refs))
    safe_zone = None
    if face_refs:
        safe_zone = SafeZoneTracker(
            out_seconds=pipeline_config.OUT_OF_ZONE_SECONDS,
            alert_cooldown=pipeline_config.OUT_OF_ZONE_ALERT_COOLDOWN,
        )
    last_yolo_boxes = []
    last_face_matches = None
    skip_frames = max(1, int(getattr(args, 'skip_frames', 1)))
    max_fps = float(getattr(args, 'max_fps', 0))

    zone_poly = parse_polygon(pipeline_config.SAFE_ZONE_POLYGON)
    if not zone_poly:
        zone_poly = default_supervisor_zone()

    # Cạnh “có người → không người” + (tùy chọn) thiếu người kéo dài → ghi left_safe_zone_events
    prev_any_person_for_snapshot = None
    prev_target_visible = None
    last_face_refetch_ts = 0.0
    last_no_person_snapshot_ts = 0.0
    no_person_snapshot_run = 0

    for frame_i, (ax, ax_second) in enumerate(animation.iter()):
        grabbed, image = capture.read()
        input_fps = capture.get(cv2.CAP_PROP_FPS)
        if not input_fps or input_fps <= 0:
            input_fps = 30.0  # webcam often returns 0; needed for fall detection & tracking
        
        if isinstance(RTSPURL, str) and RTSPURL.startswith('rtsp'):
            if grabbed:
                droppedFrames = 0
            else:
                droppedFrames += 1
                
                if droppedFrames > input_fps*5:
                    online = False
                    
                    while not capture.isOpened() or not online:
                        LOG.warning("Reconnecting to stream: " + RTSPURL)
                        capture, online, droppedFrames = reconnect(capture, RTSPURL)
                        
                continue
            
        elif image is None:
            # Video file hết: lặp lại (loop) thay vì dừng, để stream không tắt
            if isinstance(RTSPURL, str) and not RTSPURL.lower().startswith('rtsp'):
                LOG.info('video file end, looping: %s', RTSPURL)
                capture.release()
                capture = cv2.VideoCapture(RTSPURL, cv2.CAP_FFMPEG)
                if not capture.isOpened():
                    LOG.error('Cannot reopen video file: %s', RTSPURL)
                    break
                # Tránh cạnh "có người → không người" giả ngay frame đầu sau khi loop,
                # khiến left_safe_zone_events bắn nhầm hoặc trạng thái lệch.
                prev_any_person_for_snapshot = None
                continue
            LOG.info('no more images captured')
            capture.release()
            break
        
        if args.max_frames is not None and frame_i >= args.max_frames:
            break
        
        if float(scale) != 1.0:
            image = cv2.resize(image, None, fx=float(scale), fy=float(scale))
            LOG.debug('resized image size: %s', image.shape)
        
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        if ax is None:
            ax, ax_second = animation.frame_init(image)
        visualizer.BaseVisualizer.image(image)
        visualizer.BaseVisualizer.common_ax = ax_second

        # Chỉ chạy mô hình mỗi skip_frames frame để giảm tải
        if frame_i % skip_frames == 0:
            start = time.time()
            image_pil = PIL.Image.fromarray(image)
            processed_image, _, __ = transforms.EVAL_TRANSFORM(image_pil, [], None)
            LOG.debug('preprocessing time %.3fs', time.time() - start)

            preds = processor.batch(model, torch.unsqueeze(processed_image, 0), device=args.device)[0]
            last_preds = preds
        else:
            preds = last_preds

        ax.imshow(image)
        if frame_i % pipeline_config.YOLO_EVERY_N_FRAMES == 0 and yolo_detector.yolo_available():
            last_yolo_boxes = yolo_detector.detect_person_boxes(
                image, conf=pipeline_config.YOLO_CONF
            )

        if (
            pipeline_config.FACE_REFS_REFRESH_SECONDS > 0
            and getattr(face_recognizer, "HAS_FACE_RECOGNITION", False)
        ):
            now_ref = time.time()
            if now_ref - last_face_refetch_ts >= pipeline_config.FACE_REFS_REFRESH_SECONDS:
                last_face_refetch_ts = now_ref
                face_refs = face_recognizer.load_face_references()
                if face_refs and safe_zone is None:
                    safe_zone = SafeZoneTracker(
                        out_seconds=pipeline_config.OUT_OF_ZONE_SECONDS,
                        alert_cooldown=pipeline_config.OUT_OF_ZONE_ALERT_COOLDOWN,
                    )
                LOG.info("Làm mới ảnh tham chiếu: %d embedding.", len(face_refs))

        # Nhận diện khuôn mặt từ DB (health_profiles.face_image_url) để gắn tên người cần giám sát
        if face_refs and (frame_i % pipeline_config.FACE_RECOGNITION_INTERVAL == 0):
            try:
                face_matches = face_recognizer.match_faces_in_image(image, face_refs)
                last_face_matches = face_matches
                last_face_texts = face_recognizer.assign_names_to_predictions(preds, face_matches, xy_scale=1.0)
                if face_matches and any(getattr(m, "name", None) for m in face_matches):
                    LOG.info("Nhận diện: %s", [getattr(m, "name", "") for m in face_matches])
            except Exception as e:
                LOG.warning("face recognition: %s", e)
        if last_face_texts is not None:
            texts_to_use = (last_face_texts + [""] * max(0, len(preds) - len(last_face_texts)))[:len(preds)]
        else:
            texts_to_use = None
        if (
            face_refs
            and pipeline_config.FACE_SINGLE_PERSON_FALLBACK
            and len(preds) == 1
            and len(face_refs) == 1
            and (texts_to_use is None or not any(texts_to_use))
        ):
            first_name = face_refs[0][0]
            if first_name:
                texts_to_use = [first_name]

        h_img, w_img = image.shape[:2]
        primary_pose_index, matched_profile_id, matched_name = _resolve_primary_subject(
            texts_to_use, preds, face_refs
        )

        target_visible = False
        if face_refs:
            target_visible = primary_pose_index is not None
            if pipeline_config.STRICT_EMPTY_ROOM and not last_yolo_boxes:
                target_visible = False
        if safe_zone is not None:
            if target_visible:
                safe_zone.mark_target_seen()
            if safe_zone.should_emit_alert() and animation.fig is not None:
                try:
                    buf = io.BytesIO()
                    animation.fig.savefig(buf, format="jpeg", dpi=72, bbox_inches="tight", pad_inches=0.02)
                    buf.seek(0)
                    pid_alert = matched_profile_id
                    if pid_alert is None and len(face_refs) == 1:
                        pid_alert = face_refs[0][1]
                    fall_event_client.send_out_of_zone_snapshot(
                        buf.getvalue(), pipeline_config.CAMERA_ID, profile_id=pid_alert
                    )
                    LOG.warning("Cảnh báo: không thấy người được giám sát trong khung hình (đủ lâu).")
                except Exception as e:
                    LOG.warning("Gửi cảnh báo rời vùng quan sát thất bại: %s", e)

        fall_restrict = bool(face_refs)
        yolo_motion = None
        if fall_restrict:
            yolo_motion = (
                _yolo_boxes_for_primary_pose(
                    primary_pose_index, preds, last_yolo_boxes, w_img, h_img
                )
                if primary_pose_index is not None
                else []
            )
        highlight_colors = _pose_highlight_colors(preds, primary_pose_index) if face_refs else None

        fall_fps = max(1.5, min(float(input_fps), float(prev_output_fps)))
        fallcount = annotation_painter.annotations(
            ax,
            preds,
            ID,
            fall_fps,
            texts=texts_to_use,
            yolo_boxes=last_yolo_boxes,
            colors=highlight_colors,
            primary_annotation_index=primary_pose_index,
            restrict_fall_to_primary=fall_restrict,
            yolo_boxes_motion=yolo_motion,
        )
        if fallcount is not None:
            if fallcount > old_fallcount and animation.fig is not None:
                try:
                    buf = io.BytesIO()
                    animation.fig.savefig(buf, format="jpeg", dpi=72, bbox_inches="tight", pad_inches=0.02)
                    buf.seek(0)
                    profile_id_fall = matched_profile_id
                    if profile_id_fall is None and len(face_refs) == 1:
                        profile_id_fall = face_refs[0][1]
                    fall_event_client.send_fall_image_to_backend(
                        buf.getvalue(),
                        camera_id=pipeline_config.CAMERA_ID,
                        profile_id=profile_id_fall,
                        severity_level="high",
                    )
                except Exception as e:
                    LOG.warning("Gửi ảnh té lên Backend thất bại: %s", e)
            old_fallcount = fallcount

        any_person = _any_person_in_frame(last_yolo_boxes, preds)
        primary_bbox = None
        person_in_zone = False
        supervisor_missing = False
        if pipeline_config.SUPERVISOR_ZONE_ENABLED:
            if face_refs:
                supervisor_missing = not target_visible
                if target_visible:
                    primary_bbox = _primary_subject_bbox(
                        primary_pose_index, preds, last_yolo_boxes, w_img, h_img
                    )
                    if primary_bbox is not None and zone_poly:
                        person_in_zone = _bbox_center_in_polygon(
                            primary_bbox, zone_poly, w_img, h_img
                        )
            else:
                supervisor_missing = not any_person
                if any_person:
                    primary_bbox = _primary_person_bbox(
                        last_yolo_boxes, preds, w_img, h_img
                    )
                    if primary_bbox is not None and zone_poly:
                        person_in_zone = _bbox_center_in_polygon(
                            primary_bbox, zone_poly, w_img, h_img
                        )
                    elif zone_poly:
                        person_in_zone = _any_person_in_supervisor_zone(
                            last_yolo_boxes, preds, w_img, h_img, zone_poly
                        )

        if getattr(ax, "_supervisor_zone_patch", None) is not None:
            try:
                ax._supervisor_zone_patch.remove()
            except Exception:
                pass
            ax._supervisor_zone_patch = None
        if getattr(ax, "_supervisor_msg", None) is not None:
            try:
                ax._supervisor_msg.remove()
            except Exception:
                pass
            ax._supervisor_msg = None

        if pipeline_config.SUPERVISOR_ZONE_ENABLED and primary_bbox is not None:
            x1, y1, x2, y2 = primary_bbox
            edge = "#22c55e" if person_in_zone else "#ef4444"
            patch = mpatches.Rectangle(
                (x1, y1),
                x2 - x1,
                y2 - y1,
                fill=False,
                edgecolor=edge,
                linewidth=2.8,
                zorder=12,
            )
            ax.add_patch(patch)
            ax._supervisor_zone_patch = patch

        if pipeline_config.SUPERVISOR_ZONE_ENABLED and supervisor_missing:
            sup_msg = (
                "Không phát hiện người được giám sát"
                if face_refs
                else "Không phát hiện người"
            )
            ax._supervisor_msg = ax.text(
                0.5,
                0.5,
                sup_msg,
                fontsize=15,
                color="white",
                ha="center",
                va="center",
                transform=ax.transAxes,
                bbox={
                    "facecolor": "#b91c1c",
                    "alpha": 0.92,
                    "linewidth": 0,
                    "pad": 0.45,
                },
                zorder=25,
            )

        loop_time = time.time() - last_loop
        if max_fps > 0 and loop_time < 1.0 / max_fps:
            time.sleep(1.0 / max_fps - loop_time)
            loop_time = time.time() - last_loop
        output_fps = 1.0 / max(loop_time, 1e-6)
        prev_output_fps = max(0.8, output_fps)

        ax.text(0, 0.95, "FPS: {:.1f}".format(output_fps), fontsize=16, color='black', transform=ax.transAxes, bbox={'facecolor': 'white', 'alpha': 0.5, 'linewidth': 0, 'pad': 0.1})
        if face_refs:
            names_lbl = ", ".join(sorted({(r[0] or "").strip() for r in face_refs if (r[0] or "").strip()}))
            status_lbl = " — đang thấy: {}".format(matched_name) if matched_name else ""
            ax.text(
                0.5,
                0.02,
                "Người cần giám sát: {}{}".format(names_lbl or "N/A", status_lbl),
                fontsize=14,
                color="white",
                transform=ax.transAxes,
                ha="center",
                bbox={"facecolor": "#4B2E83", "alpha": 0.9, "linewidth": 0, "pad": 0.3},
            )
        if fallcount is not None:
            ax.text(0, 0.9, "Fall Count: {}".format(fallcount), fontsize=16, color='black', transform=ax.transAxes, bbox={'facecolor': 'white', 'alpha': 0.5, 'linewidth': 0, 'pad': 0.1})
            old_fallcount = fallcount
        else:
            ax.text(0, 0.9, "Fall Count: {}".format(old_fallcount), fontsize=16, color='black', transform=ax.transAxes, bbox={'facecolor': 'white', 'alpha': 0.5, 'linewidth': 0, 'pad': 0.1})

        # Đếm frame liên tiếp supervisor_missing (trước khi cập nhật prev_any_person)
        if pipeline_config.SUPERVISOR_ZONE_ENABLED and supervisor_missing:
            no_person_snapshot_run += 1
        else:
            no_person_snapshot_run = 0

        # POST left_safe_zone_events: (1) cạnh có người → mất, hoặc (2) không người liên tục đủ lâu
        # (trường hợp YOLO/pose không bao giờ báo có người — UI vẫn báo đỏ nhưng DB không có nếu chỉ dùng cạnh)
        should_snapshot_edge = (
            (prev_target_visible is True and not target_visible)
            if face_refs
            else (prev_any_person_for_snapshot is True and supervisor_missing)
        )
        should_snapshot_sustained = (
            pipeline_config.SUPERVISOR_NO_PERSON_SUSTAINED_SNAPSHOT
            and supervisor_missing
            and no_person_snapshot_run >= pipeline_config.SUPERVISOR_NO_PERSON_SUSTAINED_FRAMES
        )
        if (
            pipeline_config.SUPERVISOR_ZONE_ENABLED
            and pipeline_config.SUPERVISOR_NO_PERSON_SNAPSHOT
            and animation.fig is not None
            and (should_snapshot_edge or should_snapshot_sustained)
        ):
            now_ts = time.time()
            if now_ts - last_no_person_snapshot_ts >= pipeline_config.SUPERVISOR_NO_PERSON_COOLDOWN_SECONDS:
                try:
                    buf = io.BytesIO()
                    animation.fig.savefig(buf, format="jpeg", dpi=72, bbox_inches="tight", pad_inches=0.02)
                    buf.seek(0)
                    note_kind = "edge" if should_snapshot_edge else "sustained"
                    ok = fall_event_client.send_left_safe_zone_image_to_backend(
                        buf.getvalue(),
                        camera_id=pipeline_config.CAMERA_ID,
                        zone_id=pipeline_config.SAFE_ZONE_ID,
                        severity_level="medium",
                    )
                    if ok:
                        last_no_person_snapshot_ts = now_ts
                        no_person_snapshot_run = 0
                        LOG.warning(
                            "Đã gửi ảnh 'Không phát hiện người' (%s) → left_safe_zone_events (camera_id=%s).",
                            note_kind,
                            pipeline_config.CAMERA_ID,
                        )
                except Exception as e:
                    LOG.warning("Chụp/gửi ảnh không phát hiện người thất bại: %s", e)
        
        if args.device == torch.device('cpu'):
            LOG.debug(
                'frame %d, loop time = %.3fs, input FPS = %.3f, output FPS = %.3f',
                frame_i,
                loop_time,
                input_fps,
                output_fps,
            )
        else:
            print('frame {}, input FPS = {}, output FPS = {}'.format(
                frame_i,
                int(input_fps),
                output_fps
                ))
        
        # Chế độ stream cho API: ghi frame JPEG + trạng thái để Frontend hiển thị liên tục
        if (
            stream_state is not None
            and animation.fig is not None
            and (frame_i % pipeline_config.STREAM_UPDATE_EVERY_N_FRAMES == 0)
        ):
            buf = io.BytesIO()
            try:
                animation.fig.savefig(buf, **_STREAM_JPEG_KWARGS)
                buf.seek(0)
                stream_state['jpeg'] = buf.getvalue()
                stream_state['fallcount'] = old_fallcount
                stream_state['fps'] = output_fps
                stream_state['ready'] = True
                stream_state['target_visible'] = target_visible
                stream_state['person_count'] = max(len(last_yolo_boxes), len(preds))
                stream_state['matched_profile_id'] = matched_profile_id
                stream_state['matched_name'] = matched_name or ""
                stream_state['face_references_count'] = len(face_refs)
                stream_state['face_recognition_active'] = bool(face_refs)
                stream_state['person_in_zone'] = person_in_zone
                stream_state['supervisor_missing'] = supervisor_missing
                stream_state['any_person'] = any_person
            except Exception as e:
                LOG.debug('stream_state savefig: %s', e)

        if stream_state is not None:
            stream_state["target_visible"] = target_visible
            stream_state["person_count"] = max(len(last_yolo_boxes), len(preds))
            stream_state["matched_profile_id"] = matched_profile_id
            stream_state["matched_name"] = matched_name or ""
            stream_state["face_references_count"] = len(face_refs)
            stream_state["face_recognition_active"] = bool(face_refs)
            stream_state["fallcount"] = old_fallcount
            stream_state["fps"] = output_fps
            stream_state["person_in_zone"] = person_in_zone
            stream_state["supervisor_missing"] = supervisor_missing
            stream_state["any_person"] = any_person

        if pipeline_config.SUPERVISOR_ZONE_ENABLED:
            prev_any_person_for_snapshot = any_person
            if face_refs:
                prev_target_visible = target_visible

        last_loop = time.time()

    return


def main():
    args = cli()
    
    if args.device == torch.device('cuda'):
        mp.set_start_method('forkserver')
    
    if args.source is None:
        settings = config.ConfigParser().getConfig()
        streamer = core.MultiStreamLoader(settings['RTSPAPI'])
    else:
        streamer = (args.source, "webcam", args.scale)
        inference(args, streamer)
        
        return
    
    streams = streamer.generateStreams()

    queue = mp.Queue(-1)
    listener = mp.Process(
        target=logger.listener_process, args=(queue,))
    listener.start()

    logger.root_configurer(queue, args.log_level)
    
    processes = []
    
    for stream in streams:
        process = mp.Process(target=inference, args=(args, stream))
        process.start()
        processes.append(process)

    for process in processes:
        process.join()


if __name__ == '__main__':
    main()

