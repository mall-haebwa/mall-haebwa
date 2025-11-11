import boto3
from botocore.exceptions import ClientError
import os
from typing import BinaryIO
import logging

logger = logging.getLogger(__name__)

class S3Client:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_S3_REGION", "ap-northeast-2")        
        )
        self.bucket_name = os.getenv("AWS_S3_BUCKET_NAME", "mall-dev-products")
        
    def upload_file(self, file_obj: BinaryIO, object_name: str, content_type: str = 'image/jpeg') -> str:
        """
        S3에 파일 업로드

        Args:
            file_obj: 업로드할 파일 객체
            object_name: S3에 저장될 객체 이름 (예: 'products/abc123.jpg')        
            content_type: 파일의 Content-Type

        Returns:
            업로드된 파일의 URL
        """
        try:
            self.s3_client.upload_fileobj(
                file_obj,
                self.bucket_name,
                object_name,
                ExtraArgs={
                    'ContentType': content_type,
                    'CacheControl': 'max-age=31536000'
                }
            )
            
            # URL 생성
            url = f"https://{self.bucket_name}.s3.{os.getenv('AWS_S3_REGION')}.amazonaws.com/{object_name}"
            logger.info(f"File uploaded successfully: {url}")
            return url
        
        except ClientError as e:
            logger.error(f"Error uploading file to S3: {e}")
            raise Exception(f"S3 upload failed: {str(e)}")
        
    def delete_file(self, object_name: str) -> bool:
          """
          S3에서 파일 삭제

          Args:
              object_name: 삭제할 객체 이름

          Returns:
              성공 여부
          """
          try:
              self.s3_client.delete_object(Bucket=self.bucket_name, Key=object_name)
              logger.info(f"File deleted successfully: {object_name}")
              return True
          except ClientError as e:
              logger.error(f"Error deleting file from S3: {e}")
              return False
          
s3_client = S3Client()

