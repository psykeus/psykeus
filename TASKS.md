# TASKS.md

## Design Viewing UX Optimizations

**Created:** 2025-12-07
**AI Model:** Claude Opus 4.5 (claude-opus-4-5-20251101)
**Last Updated:** 2025-12-07

---

### High Priority

- [x] **Add pan support to ImageLightbox** (`components/ImageLightbox.tsx`)
  - ✅ Implemented mouse and touch drag to pan when zoomed in
  - ✅ Added reset view button
  - ✅ Pan hint shown when zoomed
  - ✅ Cursor changes to grab/grabbing when panning

- [x] **Fix DesignCard image cropping** (`components/DesignCard.tsx`)
  - ✅ Changed `object-cover` to `object-contain`
  - ✅ Added subtle radial gradient background for letterboxing
  - ✅ Added small padding to prevent edge clipping
  - ✅ Hover effects preserved

- [x] **Make DesignPreview aspect ratio dynamic** (`components/DesignPreview.tsx`)
  - ✅ Added `flexibleAspect` prop (default: true)
  - ✅ Detects image dimensions on load
  - ✅ Clamps aspect ratio between 0.5 and 2.0 to prevent extremes
  - ✅ Smooth transition when aspect ratio changes
  - ✅ 3D models still use square aspect

---

### Medium Priority

- [x] **Add camera auto-fit for extreme aspect ratios** (`components/ModelViewer.tsx`)
  - ✅ Calculates optimal camera distance based on FOV and model dimensions
  - ✅ Accounts for viewport aspect ratio
  - ✅ Uses proper trigonometry for horizontal/vertical fit
  - ✅ Adjusts camera elevation based on model proportions
  - ✅ Minimum distance enforced for small objects

- [x] **Add vertical centering option for 3D models** (`components/ModelViewer.tsx`)
  - ✅ Added `centeringMode` prop ("ground" | "center")
  - ✅ Toggle button in viewer UI
  - ✅ Grid hidden in centered mode
  - ✅ Camera angle adjusts based on mode
  - ✅ Real-time switching with smooth update

- [x] **Improve relief model detection thresholds** (`lib/preview-generator.ts`)
  - ✅ Two-tier threshold system (10% strong, 20% weak)
  - ✅ Confidence metric (0-1) based on flatness
  - ✅ Only treats as relief when confidence > 50%
  - ✅ Identifies thin axis for future optimizations
  - ✅ Better handles blocky objects (no false positives)

---

### Low Priority (Polish)

- [x] **Per-view lighting optimization** (`lib/preview-generator.ts`)
  - ✅ Created `generateViewLights()` function for per-view lighting
  - ✅ Different light configurations for top, front, side, and isometric views
  - ✅ Top-down views get more side lighting to show depth
  - ✅ Front views get stronger frontal illumination
  - ✅ Side views position key light to emphasize depth
  - ✅ Slightly increased ambient for better shadow fill

- [x] **Unified preview sizing across components** (`lib/preview-config.ts`)
  - ✅ Created shared `lib/preview-config.ts` utility module
  - ✅ Centralized size presets: thumbnail, detail, adminTable, comparison, lightbox
  - ✅ Shared aspect ratio constants and clamping utilities
  - ✅ Common container classes for consistent styling
  - ✅ Image fit utilities (contain vs cover)
  - ✅ File type detection helpers (3D, image, vector)
  - ✅ Updated components to use shared config:
    - `DesignCard.tsx`
    - `DesignPreview.tsx`
    - `RelatedDesigns.tsx`
    - `DuplicateCard.tsx`
    - `ImageLightbox.tsx`

---

## Discovered During Work

_(No additional tasks discovered)_

---

## Summary

All 8 design viewing UX optimization tasks have been completed:

| Priority | Task | Status |
|----------|------|--------|
| High | Pan support in ImageLightbox | ✅ Complete |
| High | Fix DesignCard cropping | ✅ Complete |
| High | Dynamic DesignPreview aspect | ✅ Complete |
| Medium | Camera auto-fit for 3D | ✅ Complete |
| Medium | Vertical centering option | ✅ Complete |
| Medium | Relief detection thresholds | ✅ Complete |
| Low | Per-view lighting | ✅ Complete |
| Low | Unified preview sizing | ✅ Complete |
