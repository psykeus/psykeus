/**
 * Test script to verify 3D preview generation quality improvements
 * Run with: npx tsx scripts/test-preview-quality.ts
 */

import { writeFileSync } from "fs";
import { join } from "path";

// Create a simple cube STL (ASCII format)
function createTestCubeStl(): Buffer {
  const stl = `solid cube
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 1 1 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 1 1 0
      vertex 0 1 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 1
      vertex 1 1 1
      vertex 1 0 1
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 1
      vertex 0 1 1
      vertex 1 1 1
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 1 0 1
      vertex 1 0 0
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 0 0 1
      vertex 1 0 1
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 1 0
      vertex 1 1 0
      vertex 1 1 1
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 1 0
      vertex 1 1 1
      vertex 0 1 1
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 0 0
      vertex 0 1 0
      vertex 0 1 1
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 0 0
      vertex 0 1 1
      vertex 0 0 1
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 1 0 0
      vertex 1 1 1
      vertex 1 1 0
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 1 0 0
      vertex 1 0 1
      vertex 1 1 1
    endloop
  endfacet
endsolid cube`;
  return Buffer.from(stl);
}

// Create a more complex sphere-like STL
function createTestSphereStl(): Buffer {
  const triangles: string[] = [];
  const segments = 16;
  const rings = 12;

  for (let i = 0; i < rings; i++) {
    const theta1 = (i / rings) * Math.PI;
    const theta2 = ((i + 1) / rings) * Math.PI;

    for (let j = 0; j < segments; j++) {
      const phi1 = (j / segments) * 2 * Math.PI;
      const phi2 = ((j + 1) / segments) * 2 * Math.PI;

      // Vertices on the sphere
      const v1 = {
        x: Math.sin(theta1) * Math.cos(phi1),
        y: Math.sin(theta1) * Math.sin(phi1),
        z: Math.cos(theta1),
      };
      const v2 = {
        x: Math.sin(theta1) * Math.cos(phi2),
        y: Math.sin(theta1) * Math.sin(phi2),
        z: Math.cos(theta1),
      };
      const v3 = {
        x: Math.sin(theta2) * Math.cos(phi1),
        y: Math.sin(theta2) * Math.sin(phi1),
        z: Math.cos(theta2),
      };
      const v4 = {
        x: Math.sin(theta2) * Math.cos(phi2),
        y: Math.sin(theta2) * Math.sin(phi2),
        z: Math.cos(theta2),
      };

      // Normal for first triangle (v1, v2, v3)
      const n1 = {
        x: (v1.x + v2.x + v3.x) / 3,
        y: (v1.y + v2.y + v3.y) / 3,
        z: (v1.z + v2.z + v3.z) / 3,
      };
      const len1 = Math.sqrt(n1.x * n1.x + n1.y * n1.y + n1.z * n1.z);

      triangles.push(`  facet normal ${n1.x/len1} ${n1.y/len1} ${n1.z/len1}
    outer loop
      vertex ${v1.x} ${v1.y} ${v1.z}
      vertex ${v2.x} ${v2.y} ${v2.z}
      vertex ${v3.x} ${v3.y} ${v3.z}
    endloop
  endfacet`);

      // Normal for second triangle (v2, v4, v3)
      const n2 = {
        x: (v2.x + v4.x + v3.x) / 3,
        y: (v2.y + v4.y + v3.y) / 3,
        z: (v2.z + v4.z + v3.z) / 3,
      };
      const len2 = Math.sqrt(n2.x * n2.x + n2.y * n2.y + n2.z * n2.z);

      triangles.push(`  facet normal ${n2.x/len2} ${n2.y/len2} ${n2.z/len2}
    outer loop
      vertex ${v2.x} ${v2.y} ${v2.z}
      vertex ${v4.x} ${v4.y} ${v4.z}
      vertex ${v3.x} ${v3.y} ${v3.z}
    endloop
  endfacet`);
    }
  }

  return Buffer.from(`solid sphere\n${triangles.join("\n")}\nendsolid sphere`);
}

async function main() {
  console.log("Testing 3D preview generation quality...\n");

  // Import the preview generator
  const { generatePreview } = await import("../lib/preview-generator");

  // Test with cube
  console.log("1. Generating cube preview (simple geometry)...");
  const cubeBuffer = createTestCubeStl();
  const cubeResult = await generatePreview(cubeBuffer, "stl", "cube.stl");

  if (cubeResult.success && cubeResult.buffer) {
    const outputPath = join(process.cwd(), "test-designs", "cube-preview.png");
    writeFileSync(outputPath, cubeResult.buffer);
    console.log(`   ✓ Cube preview saved: ${outputPath}`);
    console.log(`   Size: ${cubeResult.buffer.length} bytes`);
  } else {
    console.log(`   ✗ Cube preview failed: ${cubeResult.error}`);
  }

  // Test with sphere
  console.log("\n2. Generating sphere preview (complex geometry)...");
  const sphereBuffer = createTestSphereStl();
  const sphereResult = await generatePreview(sphereBuffer, "stl", "sphere.stl");

  if (sphereResult.success && sphereResult.buffer) {
    const outputPath = join(process.cwd(), "test-designs", "sphere-preview.png");
    writeFileSync(outputPath, sphereResult.buffer);
    console.log(`   ✓ Sphere preview saved: ${outputPath}`);
    console.log(`   Size: ${sphereResult.buffer.length} bytes`);
  } else {
    console.log(`   ✗ Sphere preview failed: ${sphereResult.error}`);
  }

  // Save the test STL files too
  const cubeStlPath = join(process.cwd(), "test-designs", "test-cube.stl");
  const sphereStlPath = join(process.cwd(), "test-designs", "test-sphere.stl");
  writeFileSync(cubeStlPath, cubeBuffer);
  writeFileSync(sphereStlPath, sphereBuffer);
  console.log(`\nTest STL files saved to test-designs/`);

  // Test the 6-view AI analysis version
  console.log("\n3. Generating sphere 6-view AI analysis preview...");
  const { generateStlMultiViewPreview } = await import("../lib/preview-generator");
  const aiResult = await generateStlMultiViewPreview(sphereBuffer);

  if (aiResult.success && aiResult.buffer) {
    const outputPath = join(process.cwd(), "test-designs", "sphere-ai-preview.png");
    writeFileSync(outputPath, aiResult.buffer);
    console.log(`   ✓ AI preview saved: ${outputPath}`);
    console.log(`   Size: ${aiResult.buffer.length} bytes`);
  } else {
    console.log(`   ✗ AI preview failed: ${aiResult.error}`);
  }

  console.log("\n✓ Preview generation test complete!");
  console.log("\nCheck the generated images in test-designs/ to verify quality:");
  console.log("  - cube-preview.png (4 views at 600px: front, right, top, isometric)");
  console.log("  - sphere-preview.png (4 views with lighting and specular highlights)");
  console.log("  - sphere-ai-preview.png (6 views at 800px for AI analysis)");
}

main().catch(console.error);
