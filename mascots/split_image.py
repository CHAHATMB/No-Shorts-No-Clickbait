import cv2
import numpy as np
from PIL import Image
from pathlib import Path


# ============================================================
# CONFIGURATION
# ============================================================

INPUT = "shime_animation.png"

OUTPUT_DIR = Path("walking_animation")

# Your sheet contains:
# 8 frames horizontally
# 4 directions vertically
COLS = 8
ROWS = 4

DIRECTIONS = [
    "right",
    "left",
    "down",
    "up"
]

# ------------------------------------------------------------
# Sprite-sheet area
#
# We deliberately exclude the text/arrows on the left.
#
# Approximate area containing the 8 x 4 character grid.
# These values can be adjusted if necessary.
# ------------------------------------------------------------

GRID_X0 = 118
GRID_X1 = 945

GRID_Y0 = 58
GRID_Y1 = 583


# ------------------------------------------------------------
# Background threshold
#
# The original image has a white background.
#
# Pixels darker than this are considered part of the sprite.
# Lower = stricter
# Higher = catches more anti-aliased pixels
# ------------------------------------------------------------

WHITE_THRESHOLD = 245

# Small noise removal
MIN_COMPONENT_AREA = 10

# Padding around detected character before normalization
SPRITE_PADDING = 3

# Size of final animation frame.
#
# Automatically calculated from detected sprites unless
# OVERRIDE_FRAME_SIZE is set.
# ------------------------------------------------------------

OVERRIDE_FRAME_SIZE = None
# Example:
# OVERRIDE_FRAME_SIZE = (80, 120)


# ============================================================
# LOAD IMAGE
# ============================================================

image = cv2.imread(INPUT)

if image is None:
    raise FileNotFoundError(f"Could not open: {INPUT}")

image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

height, width = image.shape[:2]

print(f"Input image: {width} x {height}")


# ============================================================
# CALCULATE GRID
# ============================================================

cell_width = (GRID_X1 - GRID_X0) / COLS
cell_height = (GRID_Y1 - GRID_Y0) / ROWS

print(f"Grid cell: {cell_width:.1f} x {cell_height:.1f}")


# ============================================================
# DETECT SPRITE INSIDE ONE CELL
# ============================================================

def detect_sprite(cell):

    # Convert to grayscale
    gray = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)

    # Everything sufficiently darker than white becomes foreground
    mask = gray < WHITE_THRESHOLD

    # Convert bool -> uint8
    mask = (mask.astype(np.uint8) * 255)

    # Remove tiny JPEG artifacts/noise
    kernel = np.ones((2, 2), np.uint8)

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        kernel
    )

    # Find connected components
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        mask,
        connectivity=8
    )

    components = []

    for i in range(1, num_labels):

        x = stats[i, cv2.CC_STAT_LEFT]
        y = stats[i, cv2.CC_STAT_TOP]

        w = stats[i, cv2.CC_STAT_WIDTH]
        h = stats[i, cv2.CC_STAT_HEIGHT]

        area = stats[i, cv2.CC_STAT_AREA]

        if area < MIN_COMPONENT_AREA:
            continue

        components.append({
            "x": x,
            "y": y,
            "w": w,
            "h": h,
            "area": area
        })

    if not components:
        return None, None

    # --------------------------------------------------------
    # Combine components belonging to the character.
    #
    # A character consists of multiple disconnected pieces:
    # hair, body, shoes, outlines, etc.
    #
    # We therefore create one bounding box around components
    # in the central part of the cell.
    # --------------------------------------------------------

    cell_h, cell_w = gray.shape

    # Ignore the extreme bottom where frame numbers/text
    # may exist.
    usable_bottom = int(cell_h * 0.90)

    useful = []

    for c in components:

        center_x = c["x"] + c["w"] / 2
        center_y = c["y"] + c["h"] / 2

        # Ignore components very close to bottom edge
        if center_y > usable_bottom:
            continue

        # Ignore tiny things
        if c["w"] < 2 or c["h"] < 2:
            continue

        # Character should generally be somewhere near center
        # of its grid cell.
        if center_x < cell_w * 0.15:
            continue

        if center_x > cell_w * 0.85:
            continue

        useful.append(c)

    if not useful:
        return None, None

    # Bounding box of all useful character pieces
    min_x = min(c["x"] for c in useful)
    min_y = min(c["y"] for c in useful)

    max_x = max(c["x"] + c["w"] for c in useful)
    max_y = max(c["y"] + c["h"] for c in useful)

    # Padding
    min_x = max(0, min_x - SPRITE_PADDING)
    min_y = max(0, min_y - SPRITE_PADDING)

    max_x = min(cell_w, max_x + SPRITE_PADDING)
    max_y = min(cell_h, max_y + SPRITE_PADDING)

    sprite = cell[min_y:max_y, min_x:max_x]

    # Crop mask too
    sprite_mask = mask[min_y:max_y, min_x:max_x]

    return sprite, sprite_mask


# ============================================================
# EXTRACT ALL 32 SPRITES
# ============================================================

sprites = []

for row in range(ROWS):

    direction = DIRECTIONS[row]

    for col in range(COLS):

        # Grid cell coordinates
        x0 = int(GRID_X0 + col * cell_width)
        x1 = int(GRID_X0 + (col + 1) * cell_width)

        y0 = int(GRID_Y0 + row * cell_height)
        y1 = int(GRID_Y0 + (row + 1) * cell_height)

        cell = image[y0:y1, x0:x1]

        sprite, mask = detect_sprite(cell)

        if sprite is None:

            print(
                f"WARNING: Could not detect "
                f"{direction}_{col + 1}"
            )

            continue

        sprites.append({
            "direction": direction,
            "frame": col + 1,
            "image": sprite,
            "mask": mask
        })

        print(
            f"Detected {direction}_{col + 1}: "
            f"{sprite.shape[1]} x {sprite.shape[0]}"
        )


# ============================================================
# DETERMINE COMMON ANIMATION FRAME SIZE
# ============================================================

max_width = 0
max_height = 0

for s in sprites:

    h, w = s["image"].shape[:2]

    max_width = max(max_width, w)
    max_height = max(max_height, h)


if OVERRIDE_FRAME_SIZE:
    frame_width, frame_height = OVERRIDE_FRAME_SIZE
else:
    # A little extra room
    frame_width = max_width + 8
    frame_height = max_height + 8


print()
print("Final animation frame size:")
print(f"{frame_width} x {frame_height}")


# ============================================================
# CREATE OUTPUT DIRECTORIES
# ============================================================

for direction in DIRECTIONS:
    (OUTPUT_DIR / direction).mkdir(
        parents=True,
        exist_ok=True
    )

(OUTPUT_DIR / "sprite_sheets").mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# PUT EACH SPRITE ON COMMON TRANSPARENT CANVAS
# ============================================================

final_frames = {}

for s in sprites:

    direction = s["direction"]
    frame_number = s["frame"]

    bgr = s["image"]
    mask = s["mask"]

    h, w = bgr.shape[:2]

    # --------------------------------------------------------
    # Create transparent RGBA canvas
    # --------------------------------------------------------

    canvas = np.zeros(
        (frame_height, frame_width, 4),
        dtype=np.uint8
    )

    # --------------------------------------------------------
    # Convert BGR -> RGB
    # --------------------------------------------------------

    rgb = cv2.cvtColor(
        bgr,
        cv2.COLOR_BGR2RGB
    )

    # --------------------------------------------------------
    # IMPORTANT:
    #
    # Align sprites at bottom-center.
    #
    # This prevents the character from jumping around
    # when animation frames change.
    # --------------------------------------------------------

    x = (frame_width - w) // 2
    y = frame_height - h

    # Make sure it fits
    if x < 0 or y < 0:
        print(
            f"WARNING: sprite too large: "
            f"{direction}_{frame_number}"
        )
        continue

    # RGB
    canvas[y:y+h, x:x+w, :3] = rgb

    # Alpha
    canvas[y:y+h, x:x+w, 3] = mask

    final_frames[(direction, frame_number)] = canvas


# ============================================================
# SAVE INDIVIDUAL PNG FRAMES
# ============================================================

for direction in DIRECTIONS:

    for frame in range(1, COLS + 1):

        key = (direction, frame)

        if key not in final_frames:
            continue

        canvas = final_frames[key]

        output_file = (
            OUTPUT_DIR /
            direction /
            f"{direction}_{frame:02d}.png"
        )

        Image.fromarray(
            canvas,
            "RGBA"
        ).save(output_file)

        print("Saved:", output_file)


# ============================================================
# CREATE A SPRITE SHEET FOR EACH DIRECTION
# ============================================================

for direction in DIRECTIONS:

    sheet = np.zeros(
        (
            frame_height,
            frame_width * COLS,
            4
        ),
        dtype=np.uint8
    )

    for frame in range(1, COLS + 1):

        key = (direction, frame)

        if key not in final_frames:
            continue

        canvas = final_frames[key]

        x = (frame - 1) * frame_width

        sheet[
            :,
            x:x + frame_width,
            :
        ] = canvas

    output_file = (
        OUTPUT_DIR /
        "sprite_sheets" /
        f"{direction}.png"
    )

    Image.fromarray(
        sheet,
        "RGBA"
    ).save(output_file)

    print("Created sheet:", output_file)


# ============================================================
# CREATE ONE COMPLETE 32-FRAME SPRITE SHEET
# ============================================================

sheet = np.zeros(
    (
        frame_height * ROWS,
        frame_width * COLS,
        4
    ),
    dtype=np.uint8
)

for row, direction in enumerate(DIRECTIONS):

    for frame in range(1, COLS + 1):

        key = (direction, frame)

        if key not in final_frames:
            continue

        canvas = final_frames[key]

        x = (frame - 1) * frame_width
        y = row * frame_height

        sheet[
            y:y + frame_height,
            x:x + frame_width,
            :
        ] = canvas


output_file = (
    OUTPUT_DIR /
    "walking_sprite_sheet.png"
)

Image.fromarray(
    sheet,
    "RGBA"
).save(output_file)


print()
print("=" * 60)
print("DONE")
print("=" * 60)
print()
print(f"Output directory: {OUTPUT_DIR}")
print(f"Animation frame: {frame_width} x {frame_height}")
print()
print("Directions:")
print("  right/")
print("  left/")
print("  down/")
print("  up/")
print()
print("Also created:")
print("  sprite_sheets/right.png")
print("  sprite_sheets/left.png")
print("  sprite_sheets/down.png")
print("  sprite_sheets/up.png")
print("  walking_sprite_sheet.png")
