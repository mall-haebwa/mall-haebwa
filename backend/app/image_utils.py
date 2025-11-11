from PIL import Image
import io
from typing import Tuple
import uuid

def generate_unique_filename(original_filename: str) -> str:
    """
    고유한 파일명 생성

    Args:
        original_filename: 원본 파일명

    Returns:
        UUID를 포함한 고유 파일명
    """
    ext = original_filename.split('.')[-1].lower()
    unique_id = uuid.uuid4().hex
    return f"{unique_id}.{ext}"

def process_image(
    image_bytes: bytes,
    max_size: int = 1200,
    quality: int = 85
) -> Tuple[io.BytesIO, str]:
    """
    이미지 리사이즈 및 압축

    Args:
        image_bytes: 원본 이미지 바이트
        max_size: 최대 가로/세로 크기 (픽셀)
        quality: JPEG 품질 (1-100)

    Returns:
        (처리된 이미지 BytesIO, content_type)
    """
    #PIL Image로 열기
    img = Image.open(io.BytesIO(image_bytes))

    #RGBA를 RGB로 변환
    if img.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')
        
    #리사이즈(비율 유지)
    if img.width > max_size or img.height > max_size:
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
    #압축하여 BytesIO에 저장
    output = io.BytesIO()
    img.save(output, format='JPEG', quality=quality, optimize=True)
    output.seek(0)
    
    return output, 'image/jpeg'

def create_thumbnail(
    image_bytes: bytes,
    size: Tuple[int, int] = (200, 200)
) -> Tuple[io.BytesIO, str]:
    """
    썸네일 생성

    Args:
        image_bytes: 원본 이미지 바이트
        size: 썸네일 크기 (width, height)

    Returns:
        (썸네일 이미지 BytesIO, content_type)
    """
    img = Image.open(io.BytesIO(image_bytes))

    # RGBA를 RGB로 변환
    if img.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    # 썸네일 생성 (비율 유지하며 크롭)
    img.thumbnail(size, Image.Resampling.LANCZOS)

    # 중앙 크롭하여 정확한 크기로 만들기
    if img.size != size:
        left = (img.width - size[0]) / 2
        top = (img.height - size[1]) / 2
        right = (img.width + size[0]) / 2
        bottom = (img.height + size[1]) / 2
        img = img.crop((left, top, right, bottom))

    output = io.BytesIO()
    img.save(output, format='JPEG', quality=85, optimize=True)
    output.seek(0)

    return output, 'image/jpeg'