from PIL import Image
import os


def nearest_size(size):
    allowed_sizes = [8 * (2 ** i) for i in range(8)]  # [8, 16, 32, 64, 128, 256, 512, 1024]
    return min(allowed_sizes, key=lambda x: abs(x - size))

def resize_image(file_path: str, width: int, height: int) -> str:
    base, ext = os.path.splitext(file_path)
    new_file_path = f"{base}_{width}x{height}{ext}"
    
    # Default icon size
    if width == 1024 and height == 1024:
        return file_path
    
    # Default banner size
    if width == 1920 and height == 1080:
        return file_path
    
    if os.path.exists(new_file_path):
        return new_file_path
    
    if not os.path.exists(file_path):
        return None
    
    with Image.open(file_path) as img:
        aspect_ratio = width / height
        if (width == height and width == nearest_size(width)) or \
           (aspect_ratio == 16/9 and height in [720, 1080]):
            resized_img = img.resize((width, height))
            resized_img.save(new_file_path)
    
    return new_file_path


# Testing
if __name__ == '__main__':
    file_path = '/data/NX-DB/media/01002AA01C7C2000/icon.jpg'
    new_file_path = resize_image(file_path, 100, 100)
    print(f"Resized image saved to: {new_file_path}")