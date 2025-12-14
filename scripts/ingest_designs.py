#!/usr/bin/env python3
"""
CNC Design Library - Ingestion Script

This script scans a directory of design files, generates previews,
extracts metadata using AI, and uploads everything to Supabase.

Usage:
    python ingest_designs.py /path/to/designs

Features:
    - Duplicate detection via content hash (SHA-256)
    - Near-duplicate detection via perceptual hash
    - Version tracking for updated files
    - AI-powered metadata generation
    - Automatic preview generation for SVG, DXF files
"""

import os
import sys
import hashlib
import json
import re
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Optional
from dataclasses import dataclass
from io import BytesIO

from dotenv import load_dotenv
from supabase import create_client, Client
from PIL import Image
import imagehash
from openai import OpenAI
from tqdm import tqdm

# Optional imports for preview generation
try:
    import cairosvg
    HAS_CAIROSVG = True
except ImportError:
    HAS_CAIROSVG = False
    print("Warning: cairosvg not installed. SVG preview generation disabled.")

try:
    import ezdxf
    from ezdxf.addons.drawing import matplotlib as dxf_matplotlib
    import matplotlib.pyplot as plt
    HAS_EZDXF = True
except ImportError:
    HAS_EZDXF = False
    print("Warning: ezdxf/matplotlib not installed. DXF preview generation disabled.")

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("AI_API_KEY")
AI_MODEL = os.getenv("AI_MODEL", "gpt-5-mini")

# Supported file extensions
SUPPORTED_EXTENSIONS = {".svg", ".dxf", ".ai", ".eps", ".pdf", ".cdr"}
PREVIEW_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}

# Preview settings
PREVIEW_MAX_SIZE = (800, 800)
PREVIEW_QUALITY = 85


@dataclass
class DesignFile:
    """Represents a design file to be processed."""
    path: Path
    content_hash: str
    size_bytes: int
    file_type: str


@dataclass
class AIMetadata:
    """AI-generated metadata for a design."""
    title: str
    description: str
    project_type: Optional[str]
    difficulty: Optional[str]
    materials: list[str]
    categories: list[str]
    style: Optional[str]
    tags: list[str]
    approx_dimensions: Optional[str]


class DesignIngester:
    """Main class for ingesting designs into the library."""

    def __init__(self):
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError("Missing Supabase credentials in environment")

        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        self.openai = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
        self.stats = {
            "scanned": 0,
            "skipped_duplicate": 0,
            "new_designs": 0,
            "new_versions": 0,
            "errors": 0,
            "previews_generated": 0,
        }

    def compute_content_hash(self, file_path: Path) -> str:
        """Compute SHA-256 hash of file contents."""
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    def compute_phash(self, image_path: Path) -> Optional[str]:
        """Compute perceptual hash of an image."""
        try:
            img = Image.open(image_path)
            phash = imagehash.phash(img)
            return str(phash)
        except Exception as e:
            print(f"  Warning: Could not compute phash: {e}")
            return None

    def find_preview_for_design(self, design_path: Path) -> Optional[Path]:
        """Find an existing preview image for a design file."""
        stem = design_path.stem
        parent = design_path.parent

        # Check various naming conventions
        for ext in PREVIEW_EXTENSIONS:
            # Same name with image extension
            preview_path = parent / f"{stem}{ext}"
            if preview_path.exists():
                return preview_path

            # With _preview suffix
            preview_path = parent / f"{stem}_preview{ext}"
            if preview_path.exists():
                return preview_path

            # With -preview suffix
            preview_path = parent / f"{stem}-preview{ext}"
            if preview_path.exists():
                return preview_path

            # In a previews subdirectory
            preview_path = parent / "previews" / f"{stem}{ext}"
            if preview_path.exists():
                return preview_path

        return None

    def generate_svg_preview(self, svg_path: Path, output_path: Path) -> bool:
        """Generate PNG preview from SVG file."""
        if not HAS_CAIROSVG:
            return False

        try:
            # Convert SVG to PNG
            cairosvg.svg2png(
                url=str(svg_path),
                write_to=str(output_path),
                output_width=PREVIEW_MAX_SIZE[0],
                output_height=PREVIEW_MAX_SIZE[1],
            )

            # Optimize the output
            img = Image.open(output_path)
            img.thumbnail(PREVIEW_MAX_SIZE, Image.Resampling.LANCZOS)

            # Convert to RGB if necessary (for JPEG compatibility)
            if img.mode in ('RGBA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'RGBA':
                    background.paste(img, mask=img.split()[3])
                else:
                    background.paste(img)
                img = background

            img.save(output_path, 'PNG', optimize=True)
            return True
        except Exception as e:
            print(f"  Warning: SVG preview generation failed: {e}")
            return False

    def generate_dxf_preview(self, dxf_path: Path, output_path: Path) -> bool:
        """Generate PNG preview from DXF file."""
        if not HAS_EZDXF:
            return False

        try:
            doc = ezdxf.readfile(str(dxf_path))
            msp = doc.modelspace()

            fig = plt.figure()
            ax = fig.add_axes([0, 0, 1, 1])
            ctx = dxf_matplotlib.RenderContext(doc)
            out = dxf_matplotlib.MatplotlibBackend(ax)
            dxf_matplotlib.Frontend(ctx, out).draw_layout(msp)

            ax.set_aspect('equal')
            ax.axis('off')

            fig.savefig(
                str(output_path),
                dpi=150,
                bbox_inches='tight',
                pad_inches=0.1,
                facecolor='white'
            )
            plt.close(fig)

            # Resize to target size
            img = Image.open(output_path)
            img.thumbnail(PREVIEW_MAX_SIZE, Image.Resampling.LANCZOS)
            img.save(output_path, 'PNG', optimize=True)

            return True
        except Exception as e:
            print(f"  Warning: DXF preview generation failed: {e}")
            return False

    def generate_preview(self, design_path: Path, output_path: Path) -> bool:
        """Generate a preview image for a design file."""
        suffix = design_path.suffix.lower()

        if suffix == '.svg':
            result = self.generate_svg_preview(design_path, output_path)
            if result:
                self.stats["previews_generated"] += 1
            return result
        elif suffix == '.dxf':
            result = self.generate_dxf_preview(design_path, output_path)
            if result:
                self.stats["previews_generated"] += 1
            return result
        else:
            # For other formats (AI, EPS, PDF), we'd need additional tools
            # like ImageMagick/Ghostscript
            print(f"  Note: Preview generation not implemented for {suffix}")
            return False

    def get_ai_metadata(self, preview_path: Path, filename: str) -> Optional[AIMetadata]:
        """Use AI vision to extract metadata from the design preview."""
        if not self.openai:
            print("  Warning: OpenAI not configured, using basic metadata")
            return self._generate_basic_metadata(filename)

        try:
            # Read and encode image
            import base64
            with open(preview_path, "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")

            # Determine mime type
            ext = preview_path.suffix.lower()
            mime_type = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".webp": "image/webp",
            }.get(ext, "image/png")

            response = self.openai.chat.completions.create(
                model=AI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": """You are analyzing CNC/laser cutting design files.
                        Extract metadata and return valid JSON with these fields:
                        - title: A descriptive title (without file extension)
                        - description: 2-3 sentence description of the design
                        - project_type: One of: coaster, sign, ornament, box, puzzle, jig, art, other
                        - difficulty: One of: easy, medium, hard
                        - materials: Array of suitable materials (wood, acrylic, leather, paper, metal)
                        - categories: Array of categories
                        - style: Design style (mandala, geometric, floral, minimal, detailed, celtic, tribal, etc.)
                        - tags: Array of descriptive tags (max 10)
                        - approx_dimensions: Estimated dimensions if visible (e.g., "4 inch diameter")

                        Return ONLY valid JSON, no markdown or explanation."""
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Analyze this CNC/laser design. Filename: {filename}"
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{image_data}"
                                }
                            }
                        ]
                    }
                ],
                max_completion_tokens=500,
            )

            content = response.choices[0].message.content
            # Clean up response (remove markdown code blocks if present)
            content = re.sub(r"```json\s*", "", content)
            content = re.sub(r"```\s*", "", content)

            data = json.loads(content)

            return AIMetadata(
                title=data.get("title", filename),
                description=data.get("description", ""),
                project_type=data.get("project_type"),
                difficulty=data.get("difficulty"),
                materials=data.get("materials", []),
                categories=data.get("categories", []),
                style=data.get("style"),
                tags=data.get("tags", []),
                approx_dimensions=data.get("approx_dimensions"),
            )

        except Exception as e:
            print(f"  Warning: AI metadata extraction failed: {e}")
            return self._generate_basic_metadata(filename)

    def _generate_basic_metadata(self, filename: str) -> AIMetadata:
        """Generate basic metadata from filename."""
        # Clean up filename for title
        name = Path(filename).stem
        title = name.replace("-", " ").replace("_", " ").title()

        return AIMetadata(
            title=title,
            description="",
            project_type=None,
            difficulty=None,
            materials=[],
            categories=[],
            style=None,
            tags=[],
            approx_dimensions=None,
        )

    def slugify(self, text: str) -> str:
        """Convert text to URL-friendly slug."""
        slug = text.lower()
        slug = re.sub(r"[^\w\s-]", "", slug)
        slug = re.sub(r"[\s_-]+", "-", slug)
        slug = slug.strip("-")
        return slug

    def check_duplicate(self, content_hash: str) -> Optional[dict]:
        """Check if a file with this hash already exists."""
        result = self.supabase.table("design_files").select(
            "id, design_id, version_number"
        ).eq("content_hash", content_hash).execute()

        if result.data:
            return result.data[0]
        return None

    def find_by_source_path(self, source_path: str) -> Optional[dict]:
        """Find existing design file by source path."""
        result = self.supabase.table("design_files").select(
            "id, design_id, content_hash, version_number"
        ).eq("source_path", source_path).order(
            "version_number", desc=True
        ).limit(1).execute()

        if result.data:
            return result.data[0]
        return None

    def upload_file(self, local_path: Path, bucket: str, remote_path: str) -> str:
        """Upload a file to Supabase Storage."""
        with open(local_path, "rb") as f:
            self.supabase.storage.from_(bucket).upload(
                remote_path,
                f.read(),
                {"upsert": "true"}
            )
        return remote_path

    def create_design(
        self,
        metadata: AIMetadata,
        preview_path: str,
    ) -> str:
        """Create a new design record."""
        slug = self.slugify(metadata.title)

        # Ensure unique slug
        existing = self.supabase.table("designs").select("id").eq("slug", slug).execute()
        if existing.data:
            slug = f"{slug}-{int(datetime.now().timestamp())}"

        result = self.supabase.table("designs").insert({
            "slug": slug,
            "title": metadata.title,
            "description": metadata.description,
            "preview_path": preview_path,
            "project_type": metadata.project_type,
            "difficulty": metadata.difficulty,
            "materials": metadata.materials,
            "categories": metadata.categories,
            "style": metadata.style,
            "approx_dimensions": metadata.approx_dimensions,
            "metadata_json": {
                "ai_generated": True,
                "tags": metadata.tags,
            },
            "is_public": True,
        }).execute()

        design_id = result.data[0]["id"]

        # Create tags and link them
        self._link_tags(design_id, metadata.tags)

        return design_id

    def _link_tags(self, design_id: str, tag_names: list[str]) -> None:
        """Create tags if needed and link them to design."""
        for tag_name in tag_names:
            tag_name = tag_name.lower().strip()
            if not tag_name:
                continue

            # Get or create tag
            existing = self.supabase.table("tags").select("id").eq("name", tag_name).execute()

            if existing.data:
                tag_id = existing.data[0]["id"]
            else:
                result = self.supabase.table("tags").insert({"name": tag_name}).execute()
                tag_id = result.data[0]["id"]

            # Link tag to design
            try:
                self.supabase.table("design_tags").insert({
                    "design_id": design_id,
                    "tag_id": tag_id,
                }).execute()
            except Exception:
                pass  # Ignore duplicate links

    def create_design_file(
        self,
        design_id: str,
        storage_path: str,
        file_type: str,
        size_bytes: int,
        content_hash: str,
        preview_phash: Optional[str],
        source_path: str,
        version_number: int,
    ) -> str:
        """Create a new design file record."""
        result = self.supabase.table("design_files").insert({
            "design_id": design_id,
            "storage_path": storage_path,
            "file_type": file_type,
            "size_bytes": size_bytes,
            "content_hash": content_hash,
            "preview_phash": preview_phash,
            "source_path": source_path,
            "version_number": version_number,
            "is_active": True,
        }).execute()

        return result.data[0]["id"]

    def update_current_version(self, design_id: str, file_id: str) -> None:
        """Update the design's current version pointer."""
        # Deactivate old versions
        self.supabase.table("design_files").update({
            "is_active": False
        }).eq("design_id", design_id).neq("id", file_id).execute()

        # Set current version
        self.supabase.table("designs").update({
            "current_version_id": file_id,
            "updated_at": datetime.now().isoformat(),
        }).eq("id", design_id).execute()

    def process_file(self, file_path: Path, base_dir: Path) -> None:
        """Process a single design file."""
        self.stats["scanned"] += 1
        relative_path = str(file_path.relative_to(base_dir))

        print(f"\nProcessing: {relative_path}")

        # Compute content hash
        content_hash = self.compute_content_hash(file_path)
        file_size = file_path.stat().st_size
        file_type = file_path.suffix.lower().lstrip(".")

        # Check for exact duplicate
        duplicate = self.check_duplicate(content_hash)
        if duplicate:
            print(f"  Skipped: Exact duplicate (design {duplicate['design_id']})")
            self.stats["skipped_duplicate"] += 1
            return

        # Check for existing file by source path (potential new version)
        existing = self.find_by_source_path(relative_path)

        # Find or generate preview
        preview_path = self.find_preview_for_design(file_path)
        temp_preview = None

        if not preview_path:
            # Try to generate preview
            temp_preview = Path(tempfile.mktemp(suffix='.png'))
            if self.generate_preview(file_path, temp_preview):
                preview_path = temp_preview
                print(f"  Generated preview")
            else:
                print(f"  Warning: No preview available")

        # Compute perceptual hash if we have a preview
        phash = None
        if preview_path and preview_path.exists():
            phash = self.compute_phash(preview_path)

        if existing:
            # New version of existing design
            print(f"  Creating new version (was v{existing['version_number']})")

            design_id = existing["design_id"]
            version_number = existing["version_number"] + 1

            # Upload file
            storage_path = f"files/{design_id}/v{version_number}{file_path.suffix}"
            self.upload_file(file_path, "designs", storage_path)

            # Create file record
            file_id = self.create_design_file(
                design_id=design_id,
                storage_path=storage_path,
                file_type=file_type,
                size_bytes=file_size,
                content_hash=content_hash,
                preview_phash=phash,
                source_path=relative_path,
                version_number=version_number,
            )

            # Update current version
            self.update_current_version(design_id, file_id)

            print(f"  Created version {version_number}")
            self.stats["new_versions"] += 1

        else:
            # Brand new design
            print(f"  Creating new design")

            # Get AI metadata
            metadata = None
            if preview_path and preview_path.exists():
                metadata = self.get_ai_metadata(preview_path, file_path.name)
            else:
                metadata = self._generate_basic_metadata(file_path.name)

            # Upload preview if available
            preview_storage_path = ""
            if preview_path and preview_path.exists():
                preview_remote = f"{self.slugify(metadata.title)}-{content_hash[:8]}.png"
                self.upload_file(preview_path, "previews", preview_remote)
                # Make it a full URL for public access
                preview_storage_path = f"{SUPABASE_URL}/storage/v1/object/public/previews/{preview_remote}"

            # Create design
            design_id = self.create_design(metadata, preview_storage_path)

            # Upload design file
            storage_path = f"files/{design_id}/v1{file_path.suffix}"
            self.upload_file(file_path, "designs", storage_path)

            # Create file record
            file_id = self.create_design_file(
                design_id=design_id,
                storage_path=storage_path,
                file_type=file_type,
                size_bytes=file_size,
                content_hash=content_hash,
                preview_phash=phash,
                source_path=relative_path,
                version_number=1,
            )

            # Set current version
            self.update_current_version(design_id, file_id)

            print(f"  Created: {metadata.title}")
            self.stats["new_designs"] += 1

        # Clean up temp preview
        if temp_preview and temp_preview.exists():
            temp_preview.unlink()

    def scan_directory(self, directory: Path) -> None:
        """Scan a directory for design files."""
        print(f"Scanning: {directory}")

        # Find all design files
        design_files = []
        for ext in SUPPORTED_EXTENSIONS:
            design_files.extend(directory.rglob(f"*{ext}"))
            design_files.extend(directory.rglob(f"*{ext.upper()}"))

        # Deduplicate (case-insensitive filesystems)
        seen = set()
        unique_files = []
        for f in design_files:
            key = str(f).lower()
            if key not in seen:
                seen.add(key)
                unique_files.append(f)

        design_files = sorted(unique_files)
        print(f"Found {len(design_files)} design files")

        # Process each file
        for file_path in tqdm(design_files, desc="Processing"):
            try:
                self.process_file(file_path, directory)
            except Exception as e:
                print(f"  Error processing {file_path}: {e}")
                self.stats["errors"] += 1

    def print_summary(self) -> None:
        """Print ingestion summary."""
        print("\n" + "=" * 50)
        print("INGESTION SUMMARY")
        print("=" * 50)
        print(f"Files scanned:       {self.stats['scanned']}")
        print(f"Duplicates skipped:  {self.stats['skipped_duplicate']}")
        print(f"New designs:         {self.stats['new_designs']}")
        print(f"New versions:        {self.stats['new_versions']}")
        print(f"Previews generated:  {self.stats['previews_generated']}")
        print(f"Errors:              {self.stats['errors']}")
        print("=" * 50)


def main():
    if len(sys.argv) < 2:
        print("Usage: python ingest_designs.py /path/to/designs")
        print("\nThis script will scan the directory for design files")
        print("(.svg, .dxf, .ai, .eps, .pdf, .cdr) and ingest them")
        print("into the CNC Design Library.")
        sys.exit(1)

    directory = Path(sys.argv[1])
    if not directory.exists():
        print(f"Error: Directory not found: {directory}")
        sys.exit(1)

    if not directory.is_dir():
        print(f"Error: Not a directory: {directory}")
        sys.exit(1)

    ingester = DesignIngester()
    ingester.scan_directory(directory)
    ingester.print_summary()


if __name__ == "__main__":
    main()
