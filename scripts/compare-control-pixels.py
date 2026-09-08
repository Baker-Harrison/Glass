"""Compare equal-size UI screenshot crops without resizing or recoloring pixels.

Requires Pillow. Optional --mask measures a declared subset in addition to the
full crop, useful when surrounding application backgrounds differ.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('reference', type=Path)
parser.add_argument('candidate', type=Path)
parser.add_argument('--mask', type=Path)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
reference = Image.open(args.reference).convert('RGB')
candidate = Image.open(args.candidate).convert('RGB')
if reference.size != candidate.size:
    parser.error(f'Crop dimensions differ: {reference.size} vs {candidate.size}')
difference = ImageChops.difference(reference, candidate)
pixels = list(difference.getdata())
result = {
    'size': list(reference.size),
    'identical': difference.getbbox() is None,
    'mean_absolute_rgb_error': sum(ImageStat.Stat(difference).mean) / 3,
    'exact_pixel_percent': 100 * sum(pixel == (0, 0, 0) for pixel in pixels) / len(pixels),
}
if args.mask:
    mask = Image.open(args.mask).convert('L')
    if mask.size != reference.size:
        parser.error('Mask dimensions must match the crops')
    result['masked_mean_absolute_rgb_error'] = sum(ImageStat.Stat(difference, mask).mean) / 3
args.output.mkdir(parents=True, exist_ok=True)
difference.save(args.output / 'difference.png')
(args.output / 'metrics.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
