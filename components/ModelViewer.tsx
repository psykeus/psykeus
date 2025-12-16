"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls, STLLoader, OBJLoader, GLTFLoader } from "three-stdlib";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { Spinner } from "@/components/ui/loading-states";
import { InlineError } from "@/components/ui/error-states";

export type ModelType = "stl" | "obj" | "gltf" | "glb" | "3mf";

type CenteringMode = "ground" | "center";

interface ModelViewerProps {
  modelUrl?: string;
  modelType?: ModelType;
  className?: string;
  autoRotate?: boolean;
  fileSize?: number | null;
  /** How to position the model vertically: "ground" places on y=0, "center" centers vertically */
  centeringMode?: CenteringMode;
  // Legacy prop support
  stlUrl?: string;
}

// Format bytes to human readable string
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ModelViewer({
  modelUrl,
  modelType = "stl",
  className = "",
  autoRotate = false,
  fileSize,
  centeringMode: initialCenteringMode = "ground",
  stlUrl
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoRotating, setIsAutoRotating] = useState(autoRotate);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [centeringMode, setCenteringMode] = useState<CenteringMode>(initialCenteringMode);

  // Support legacy stlUrl prop
  const url = modelUrl || stlUrl || "";

  // Initialize scene, renderer, camera once
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene setup (only if not already created)
    if (!sceneRef.current) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f4f8);
      sceneRef.current = scene;

      // Camera setup
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(5, 5, 5);
      cameraRef.current = camera;

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Orbit controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = isAutoRotating;
      controls.autoRotateSpeed = 2;
      controlsRef.current = controls;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 10, 7);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 1024;
      directionalLight.shadow.mapSize.height = 1024;
      scene.add(directionalLight);

      const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
      backLight.position.set(-5, 5, -5);
      scene.add(backLight);

      // Grid helper (stored in ref for dynamic positioning)
      const gridHelper = new THREE.GridHelper(10, 10, 0xcccccc, 0xe0e0e0);
      gridHelper.position.y = -0.01;
      scene.add(gridHelper);
      gridRef.current = gridHelper;

      // Animation loop
      const animate = () => {
        animationIdRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      };
      window.addEventListener("resize", handleResize);

      // Cleanup on unmount only
      return () => {
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }
        window.removeEventListener("resize", handleResize);
        controls.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        sceneRef.current = null;
        rendererRef.current = null;
        cameraRef.current = null;
        controlsRef.current = null;
      };
    }
  }, []); // Empty deps - init only once

  // Update auto-rotate when state changes
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isAutoRotating;
    }
  }, [isAutoRotating]);

  // Re-center model when centering mode changes
  useEffect(() => {
    const model = modelRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const scene = sceneRef.current;

    if (!model || !camera || !controls || !scene) return;

    // Reset model transform before re-centering
    model.scale.set(1, 1, 1);
    model.position.set(0, 0, 0);

    // Get original bounding box
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Scale to fit view
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 4;
    const scale = targetSize / maxDim;
    model.scale.multiplyScalar(scale);

    // Recompute after scaling
    const scaledBox = new THREE.Box3().setFromObject(model);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

    // Center horizontally
    model.position.x = -scaledCenter.x;
    model.position.z = -scaledCenter.z;

    // Position Y based on mode
    if (centeringMode === "ground") {
      model.position.y = -scaledBox.min.y;
      if (gridRef.current) {
        gridRef.current.position.y = -0.01;
        gridRef.current.visible = true;
      }
    } else {
      model.position.y = -scaledCenter.y;
      if (gridRef.current) {
        gridRef.current.visible = false;
      }
    }

    // Update camera target
    const finalBox = new THREE.Box3().setFromObject(model);
    const finalCenter = finalBox.getCenter(new THREE.Vector3());
    controls.target.copy(finalCenter);
    controls.update();
  }, [centeringMode]);

  // Load model when URL changes
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!scene || !camera || !controls || !url) return;

    // Default material for formats without embedded materials
    const defaultMaterial = new THREE.MeshStandardMaterial({
      color: 0x6699cc,
      metalness: 0.2,
      roughness: 0.6,
      flatShading: false,
    });

    // Function to center and scale a mesh/group with auto-fit for all aspect ratios
    const centerAndScale = (object: THREE.Object3D, mode: CenteringMode = centeringMode) => {
      // Get initial bounding box
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Scale to fit view first
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetSize = 4;
      const scale = targetSize / maxDim;
      object.scale.multiplyScalar(scale);

      // Recompute bounding box after scaling
      const scaledBox = new THREE.Box3().setFromObject(object);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      const scaledSize = scaledBox.getSize(new THREE.Vector3());

      // Center the object at origin (x=0, z=0)
      object.position.x = -scaledCenter.x;
      object.position.z = -scaledCenter.z;

      // Position Y based on centering mode
      if (mode === "ground") {
        // Place on ground (y=0) - good for objects with a natural "bottom"
        object.position.y = -scaledBox.min.y;
        // Position grid at ground level
        if (gridRef.current) {
          gridRef.current.position.y = -0.01;
          gridRef.current.visible = true;
        }
      } else {
        // Center vertically - good for floating/symmetric objects
        object.position.y = -scaledCenter.y;
        // Hide or position grid at model center for centered mode
        if (gridRef.current) {
          gridRef.current.visible = false;
        }
      }

      // Get final bounding box for camera positioning
      const finalBox = new THREE.Box3().setFromObject(object);
      const finalCenter = finalBox.getCenter(new THREE.Vector3());
      const finalSize = finalBox.getSize(new THREE.Vector3());

      // Calculate optimal camera distance based on model proportions and viewport
      // Reason: For thin/flat objects, we need to back up more to see the full extent
      const container = containerRef.current;
      const viewportAspect = container ? container.clientWidth / container.clientHeight : 1;

      // Calculate the diagonal extent of the model in the XZ plane (top-down footprint)
      const horizontalExtent = Math.sqrt(finalSize.x * finalSize.x + finalSize.z * finalSize.z);

      // Calculate vertical field of view in radians (camera FOV is 45 degrees)
      const fovRadians = (45 * Math.PI) / 180;
      const halfFov = fovRadians / 2;

      // Calculate distance needed to fit the model vertically
      const verticalDistance = (finalSize.y / 2) / Math.tan(halfFov);

      // Calculate distance needed to fit the model horizontally (accounting for viewport aspect)
      const horizontalFov = 2 * Math.atan(Math.tan(halfFov) * viewportAspect);
      const halfHorizontalFov = horizontalFov / 2;
      const horizontalDistance = (horizontalExtent / 2) / Math.tan(halfHorizontalFov);

      // Use the larger distance to ensure full visibility, with padding
      const paddingFactor = 1.4; // 40% padding for comfortable viewing
      const baseDistance = Math.max(verticalDistance, horizontalDistance) * paddingFactor;

      // Ensure minimum distance for very small or flat objects
      const minDistance = targetSize * 1.2;
      const distance = Math.max(baseDistance, minDistance);

      // Calculate camera elevation based on model proportions and centering mode
      // Reason: Taller models benefit from a higher viewpoint, flat models from lower
      const heightRatio = finalSize.y / Math.max(finalSize.x, finalSize.z, 0.001);
      let elevationFactor: number;

      if (mode === "center") {
        // For centered mode, view from a more level angle
        elevationFactor = Math.min(0.7, Math.max(0.3, 0.5 + (heightRatio - 1) * 0.05));
      } else {
        // For ground mode, view from above
        elevationFactor = Math.min(0.9, Math.max(0.5, 0.7 + (heightRatio - 1) * 0.1));
      }

      camera.position.set(distance, distance * elevationFactor, distance);

      // Point camera at the true center of the object
      controls.target.copy(finalCenter);
      controls.update();
    };

    // Progress callback for loaders
    const onProgress = (event: ProgressEvent) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        setDownloadProgress(progress);
        setDownloadedBytes(event.loaded);
      } else if (fileSize) {
        // Use known fileSize if Content-Length not available
        const progress = Math.min(Math.round((event.loaded / fileSize) * 100), 99);
        setDownloadProgress(progress);
        setDownloadedBytes(event.loaded);
      }
    };

    // Remove previous model if exists
    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    // Reset state for new model
    setLoading(true);
    setError(null);
    setDownloadProgress(0);
    setDownloadedBytes(0);

    // Helper to add model to scene and store ref
    const addModelToScene = (object: THREE.Object3D) => {
      scene.add(object);
      modelRef.current = object;
      centerAndScale(object);
      setDownloadProgress(100);
      setLoading(false);
    };

    // Load model based on type
    switch (modelType) {
      case "stl": {
        const loader = new STLLoader();
        loader.load(
          url,
          (geometry) => {
            geometry.computeVertexNormals();
            const mesh = new THREE.Mesh(geometry, defaultMaterial);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            addModelToScene(mesh);
          },
          onProgress,
          (err) => {
            console.error("Error loading STL:", err);
            setError("Failed to load STL model");
            setLoading(false);
          }
        );
        break;
      }

      case "obj": {
        const loader = new OBJLoader();
        loader.load(
          url,
          (object) => {
            object.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material = defaultMaterial;
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            addModelToScene(object);
          },
          onProgress,
          (err) => {
            console.error("Error loading OBJ:", err);
            setError("Failed to load OBJ model");
            setLoading(false);
          }
        );
        break;
      }

      case "gltf":
      case "glb": {
        const loader = new GLTFLoader();
        loader.load(
          url,
          (gltf) => {
            const model = gltf.scene;
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (!child.material || (child.material instanceof THREE.MeshBasicMaterial)) {
                  child.material = defaultMaterial;
                }
              }
            });
            addModelToScene(model);
          },
          onProgress,
          (err) => {
            console.error("Error loading GLTF:", err);
            setError("Failed to load GLTF model");
            setLoading(false);
          }
        );
        break;
      }

      case "3mf": {
        const loader = new ThreeMFLoader();
        loader.load(
          url,
          (object: THREE.Group) => {
            object.traverse((child: THREE.Object3D) => {
              if (child instanceof THREE.Mesh) {
                if (!child.material || (child.material instanceof THREE.MeshBasicMaterial)) {
                  child.material = defaultMaterial;
                }
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            addModelToScene(object);
          },
          onProgress,
          (err: unknown) => {
            console.error("Error loading 3MF:", err);
            setError("Failed to load 3MF model");
            setLoading(false);
          }
        );
        break;
      }

      default:
        setError(`Unsupported model type: ${modelType}`);
        setLoading(false);
    }

    // Cleanup: remove model when URL changes
    return () => {
      if (modelRef.current && scene) {
        scene.remove(modelRef.current);
        modelRef.current = null;
      }
    };
  }, [url, modelType, fileSize]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="w-full h-full min-h-[300px] rounded-lg overflow-hidden"
      />

      {/* Loading overlay with progress */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 rounded-lg">
          <div className="flex flex-col items-center gap-3 w-48">
            <Spinner size="lg" />
            <div className="w-full space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {downloadProgress > 0 ? "Downloading..." : "Loading 3D model..."}
                </span>
                {downloadProgress > 0 && <span>{downloadProgress}%</span>}
              </div>
              {downloadProgress > 0 && (
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              )}
              {downloadedBytes > 0 && fileSize && (
                <div className="text-xs text-muted-foreground text-center">
                  {formatFileSize(downloadedBytes)} / {formatFileSize(fileSize)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 rounded-lg p-4">
          <InlineError message={error} />
        </div>
      )}

      {/* Controls overlay */}
      {!loading && !error && (
        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
          <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Drag to rotate | Scroll to zoom
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCenteringMode(centeringMode === "ground" ? "center" : "ground")}
              className="text-xs px-3 py-1 rounded transition-colors bg-background/80 text-muted-foreground hover:bg-background"
              title={centeringMode === "ground" ? "Switch to centered view" : "Switch to ground view"}
            >
              {centeringMode === "ground" ? "Ground" : "Centered"}
            </button>
            <button
              onClick={() => setIsAutoRotating(!isAutoRotating)}
              className={`text-xs px-3 py-1 rounded transition-colors ${
                isAutoRotating
                  ? "bg-primary text-primary-foreground"
                  : "bg-background/80 text-muted-foreground hover:bg-background"
              }`}
            >
              {isAutoRotating ? "Stop Rotation" : "Auto Rotate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
