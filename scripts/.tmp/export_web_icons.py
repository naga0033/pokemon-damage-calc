from PIL import Image

src = Image.open('ios/PokeDamageCalc/PokeDamageCalc/AppIcon.xcassets/AppIcon.appiconset/AppIcon.png').convert('RGBA')

for size, path in [
    (192, 'public/icon-192.png'),
    (512, 'public/icon-512.png'),
]:
    src.resize((size, size), Image.LANCZOS).save(path)
