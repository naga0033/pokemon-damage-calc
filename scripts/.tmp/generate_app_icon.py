from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# champions-like dark blue background
for y in range(SIZE):
    t = y / (SIZE - 1)
    r = int(16 + (34 - 16) * t)
    g = int(28 + (66 - 28) * t)
    b = int(58 + (126 - 58) * t)
    d.line((0, y, SIZE, y), fill=(r, g, b, 255))

# soft cyan glows around the ball
for bbox, color, blur in [
    ((180, 150, 844, 814), (72, 214, 255, 80), 28),
    ((110, 90, 914, 884), (92, 130, 255, 38), 50),
    ((690, -40, 1050, 320), (255, 255, 255, 14), 18),
]:
    layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse(bbox, fill=color)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img = Image.alpha_composite(img, layer)

# subtle stadium energy streaks
streaks = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
sd = ImageDraw.Draw(streaks)
sd.rounded_rectangle((120, 180, 920, 210), radius=14, fill=(110, 220, 255, 24))
sd.rounded_rectangle((100, 740, 900, 768), radius=14, fill=(110, 220, 255, 20))
streaks = streaks.filter(ImageFilter.GaussianBlur(18))
img = Image.alpha_composite(img, streaks)

# ball shadow
shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
sh = ImageDraw.Draw(shadow)
sh.ellipse((218, 252, 806, 840), fill=(0, 0, 0, 120))
shadow = shadow.filter(ImageFilter.GaussianBlur(26))
img = Image.alpha_composite(img, shadow)

ball = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
bd = ImageDraw.Draw(ball)
outer = (230, 220, 794, 784)

# flat pokeball
bd.ellipse(outer, fill=(255, 255, 255, 255))
bd.pieslice(outer, start=180, end=360, fill=(247, 73, 69, 255))

# center line and button
bd.rounded_rectangle((230, 487, 794, 517), radius=15, fill=(12, 12, 16, 255))
bd.ellipse((434, 424, 590, 580), fill=(12, 12, 16, 255))
bd.ellipse((454, 444, 570, 560), fill=(255, 255, 255, 255))
bd.ellipse((486, 476, 538, 528), fill=(245, 245, 245, 255))
img = Image.alpha_composite(img, ball)

# outer cyan ring accent
ring = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
rd = ImageDraw.Draw(ring)
rd.ellipse((176, 166, 848, 838), outline=(92, 226, 255, 90), width=18)
rd.ellipse((196, 186, 828, 818), outline=(173, 235, 255, 42), width=8)
ring = ring.filter(ImageFilter.GaussianBlur(2))
img = Image.alpha_composite(img, ring)

# app icon rounded mask
mask = Image.new('L', (SIZE, SIZE), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle((0, 0, SIZE, SIZE), radius=225, fill=255)
final = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
final.paste(img, (0, 0), mask)
final.save('ios/PokeDamageCalc/PokeDamageCalc/AppIcon.xcassets/AppIcon.appiconset/AppIcon.png')
