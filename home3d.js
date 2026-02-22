(() => {
  const container = document.querySelector('#stlScene');
  if (!container) return;

  const scene = new THREE.Scene();
  scene.background = null;

  const defaultFov = 36;
  const zoomFov = 28;
  const soloFov = 31;
  const defaultCameraZ = 6.95;
  const zoomCameraZ = 5.55;
  const soloCameraZ = 6.1;
  const defaultLookAtY = -0.24;
  const zoomLookAtY = 0.3;

  const camera = new THREE.PerspectiveCamera(defaultFov, 1, 0.1, 100);
  camera.position.set(0, 0, defaultCameraZ);

  let cameraCurrentFov = defaultFov;
  let cameraTargetFov = defaultFov;
  let cameraCurrentZ = defaultCameraZ;
  let cameraTargetZ = defaultCameraZ;
  let lookAtCurrentY = defaultLookAtY;
  let lookAtTargetY = defaultLookAtY;

  const setStatus = (message) => {
    container.innerHTML = '';
    const status = document.createElement('div');
    status.textContent = message;
    status.style.position = 'absolute';
    status.style.inset = '0';
    status.style.display = 'grid';
    status.style.placeItems = 'center';
    status.style.fontSize = '0.75rem';
    status.style.letterSpacing = '0.12em';
    status.style.textTransform = 'uppercase';
    status.style.color = '#333';
    status.style.textAlign = 'center';
    status.style.padding = '1rem';
    container.appendChild(status);
  };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    setStatus('WebGL not available');
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  if ('outputEncoding' in renderer && 'sRGBEncoding' in THREE) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }
  if ('toneMapping' in renderer && 'ACESFilmicToneMapping' in THREE) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.background = 'transparent';
  container.style.background = 'transparent';
  container.appendChild(renderer.domElement);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.08);
  keyLight.position.set(2.8, 4.2, 4.8);
  scene.add(keyLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.58);
  scene.add(ambientLight);

  const rimLight = new THREE.DirectionalLight(0xf2f4ff, 0.24);
  rimLight.position.set(-2.6, 1.4, -3.8);
  scene.add(rimLight);

  const ambientDefault = 0.58;
  const ambientFocus = 0.48;
  const keyDefault = 1.08;
  const keyFocus = 1.2;
  let ambientTargetIntensity = ambientDefault;
  let keyTargetIntensity = keyDefault;

  if (window.location.protocol === 'file:') {
    setStatus('Run with local server (not file://)');
    return;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Cannot load script: ${src}`));
    document.head.appendChild(s);
  });

  const ensureGLTFLoader = async () => {
    if (THREE.GLTFLoader) return true;

    const candidates = [
      'assets/vendor-legacy/GLTFLoader.js',
      'https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js'
    ];

    for (const src of candidates) {
      try {
        await loadScript(src);
        if (THREE.GLTFLoader) return true;
      } catch {
        // Try next source.
      }
    }
    return false;
  };

  const modelSources = {
    mw1: [
      'assets/models/mw1.glp',
      'assets/models/mw1.glb'
    ],
    sweater: [
      'assets/models/sweater.glb',
      'assets/models/sweater1.glb'
    ],
    button1: [
      'assets/models/button1.glb'
    ]
  };

  const models = {};
  const mixers = {};
  const limbRigs = {};
  const modelStates = {};
  let activeModelKey = null;
  let showAllModels = false;
  let introBlend = 0;

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  let targetRotY = 0;
  let dragActive = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragMoved = false;
  let zoomSettleVelocity = 0;

  const collectLimbBones = (root) => {
    const bones = [];
    root.traverse((node) => {
      if (!node.isBone) return;
      const name = String(node.name || '').toLowerCase();
      const isLeft = /(left|_l\b|\.l\b| l\b)/.test(name);
      const isRight = /(right|_r\b|\.r\b| r\b)/.test(name);

      if (/(arm|forearm|hand|shoulder)/.test(name)) {
        bones.push({
          bone: node,
          type: isLeft ? 'armL' : (isRight ? 'armR' : 'arm'),
          baseX: node.rotation.x,
          baseY: node.rotation.y,
          baseZ: node.rotation.z
        });
      } else if (/(leg|thigh|calf|shin|foot)/.test(name)) {
        bones.push({
          bone: node,
          type: isLeft ? 'legL' : (isRight ? 'legR' : 'leg'),
          baseX: node.rotation.x,
          baseY: node.rotation.y,
          baseZ: node.rotation.z
        });
      }
    });
    return bones;
  };

  const applySilverToButton1 = (root) => {
    root.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((mat) => {
        if (!mat) return;
        if (mat.color) mat.color.setHex(0xc0c0c0);
        if (typeof mat.metalness === 'number') mat.metalness = 0.95;
        if (typeof mat.roughness === 'number') mat.roughness = 0.18;
        mat.needsUpdate = true;
      });
    });
  };

  const applyFocus = (key) => {
    activeModelKey = (key && key in modelSources) ? key : null;
    const modelKeys = Object.keys(modelStates);

    if (!showAllModels) {
      cameraTargetZ = soloCameraZ;
      cameraTargetFov = soloFov;
      lookAtTargetY = zoomLookAtY;
      ambientTargetIntensity = ambientDefault;
      keyTargetIntensity = keyDefault;

      Object.entries(modelStates).forEach(([name, state]) => {
        const isSweater = name === 'sweater';
        state.targetX = isSweater ? 0 : (name === 'mw1' ? -2.8 : 2.8);
        state.targetScale = state.baseScale * (isSweater ? 1.28 : 0.001);
        state.targetRotOffset = isSweater ? 0 : (name === 'mw1' ? -0.2 : 0.2);
        state.targetY = state.baseY + (isSweater ? 0.08 : 0);
        state.targetVisibility = isSweater ? 1 : 0;
      });
      return;
    }

    if (!activeModelKey) {
      cameraTargetZ = defaultCameraZ;
      cameraTargetFov = defaultFov;
      lookAtTargetY = defaultLookAtY;
      ambientTargetIntensity = ambientDefault;
      keyTargetIntensity = keyDefault;
    } else {
      cameraTargetZ = zoomCameraZ;
      cameraTargetFov = zoomFov;
      lookAtTargetY = zoomLookAtY;
      ambientTargetIntensity = ambientFocus;
      keyTargetIntensity = keyFocus;
    }

    Object.entries(modelStates).forEach(([name, state], idx) => {
      if (!activeModelKey) {
        const spread = 1.5;
        state.targetX = (idx - ((modelKeys.length - 1) / 2)) * spread;
        state.targetScale = state.baseScale * 0.84;
        state.targetRotOffset = state.targetX < 0 ? -0.08 : 0.08;
        state.targetY = state.baseY;
        state.targetVisibility = 1;
        return;
      }

      const isActive = name === activeModelKey;
      const activeIndex = modelKeys.indexOf(activeModelKey);
      const relativeIndex = idx - activeIndex;
      const sideSign = relativeIndex < 0 ? -1 : 1;
      const sideDistance = 2.05 + (Math.max(0, Math.abs(relativeIndex) - 1) * 0.85);

      state.targetX = isActive ? 0 : sideSign * sideDistance;
      state.targetScale = state.baseScale * (isActive ? 1.2 : 0.54);
      state.targetRotOffset = isActive ? 0 : (state.targetX < 0 ? -0.3 : 0.3);
      state.targetY = state.baseY + (isActive ? 0.03 : 0.03);
      state.targetVisibility = 1;
    });
  };

  const resize = () => {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
  };
  window.addEventListener('resize', resize);
  resize();

  const onPointerDown = (event) => {
    if (!Object.keys(models).length) return;
    dragActive = true;
    dragMoved = false;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    container.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragActive) return;
    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      dragMoved = true;
    }
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    targetRotY += deltaX * 0.01;
  };

  const onPointerEnd = (event) => {
    if (dragActive && !dragMoved) {
      const rect = container.getBoundingClientRect();
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      const hits = raycaster.intersectObjects(scene.children, true);
      let hitKey = null;
      for (const hit of hits) {
        let node = hit.object;
        while (node) {
          if (node.userData && node.userData.modelKey) {
            hitKey = node.userData.modelKey;
            break;
          }
          node = node.parent;
        }
        if (hitKey) break;
      }

      if (hitKey) {
        if (!showAllModels) {
          showAllModels = true;
          applyFocus(null);
          zoomSettleVelocity = prefersReducedMotion ? 0 : -0.05;
          dragActive = false;
          dragMoved = false;
          container.releasePointerCapture?.(event.pointerId);
          return;
        }

        const isSame = activeModelKey === hitKey;
        if (isSame) {
          applyFocus(null);
          zoomSettleVelocity = prefersReducedMotion ? 0 : 0.08;
        } else {
          applyFocus(hitKey);
          zoomSettleVelocity = prefersReducedMotion ? 0 : -0.1;
        }
      }
    }

    dragActive = false;
    dragMoved = false;
    container.releasePointerCapture?.(event.pointerId);
  };

  const onPointerLeave = () => {
    dragActive = false;
    dragMoved = false;
  };

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerEnd);
  container.addEventListener('pointercancel', onPointerEnd);
  container.addEventListener('pointerleave', onPointerLeave);

  const loadModelSet = async () => {
    const hasLoader = await ensureGLTFLoader();
    if (!hasLoader) {
      setStatus('GLTF loader missing');
      console.error('THREE.GLTFLoader is not available.');
      return;
    }

    const loader = new THREE.GLTFLoader();

    const loadOne = (key, paths) => {
      let idx = 0;

      const tryNext = () => {
        if (idx >= paths.length) {
          console.error('Failed to load model:', key);
          return;
        }

        const path = paths[idx++];
        loader.load(
          path,
          (gltf) => {
            const root = gltf.scene || gltf.scenes?.[0];
            if (!root) {
              console.error('Loaded model missing scene:', key);
              return;
            }

            root.userData.modelKey = key;
            root.traverse((child) => {
              child.userData.modelKey = key;
              if (child.isMesh) {
                child.castShadow = false;
                child.receiveShadow = false;
                if (child.material) {
                  const mats = Array.isArray(child.material) ? child.material : [child.material];
                  mats.forEach((mat) => {
                    if (!mat) return;
                    mat.userData = mat.userData || {};
                    mat.userData.baseOpacity = typeof mat.opacity === 'number' ? mat.opacity : 1;
                    mat.opacity = 0;
                    mat.transparent = true;
                    mat.needsUpdate = true;
                  });
                }
              }
            });

            const box = new THREE.Box3().setFromObject(root);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            root.position.sub(center);

            const desiredHeight = 1.02;
            const safeHeight = Math.max(size.y, 0.001);
            const baseScale = desiredHeight / safeHeight;
            root.scale.setScalar(baseScale);

            models[key] = root;
            modelStates[key] = {
              baseScale,
              currentScale: baseScale,
              targetScale: baseScale,
              currentX: 0,
              targetX: 0,
              baseY: -0.2,
              currentY: -0.2,
              targetY: -0.2,
              currentVisibility: key === 'sweater' ? 1 : 0,
              targetVisibility: key === 'sweater' ? 1 : 0,
              targetRotOffset: 0,
              phase: Math.random() * Math.PI * 2
            };

            scene.add(root);

            if (key === 'button1') {
              applySilverToButton1(root);
            }

            if (gltf.animations && gltf.animations.length > 0) {
              mixers[key] = new THREE.AnimationMixer(root);
              const action = mixers[key].clipAction(gltf.animations[0]);
              action.setLoop(THREE.LoopRepeat, Infinity);
              action.play();
            } else {
              limbRigs[key] = collectLimbBones(root);
            }

            applyFocus(activeModelKey);
          },
          undefined,
          () => {
            tryNext();
          }
        );
      };

      tryNext();
    };

    Object.entries(modelSources).forEach(([key, paths]) => {
      loadOne(key, paths);
    });

    applyFocus('sweater');
  };

  loadModelSet();

  const clock = new THREE.Clock();
  let rafId = 0;
  let isAnimating = false;

  const animate = () => {
    rafId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const t = clock.getElapsedTime();

    introBlend += (1 - introBlend) * (prefersReducedMotion ? 0.32 : 0.055);
    const introScaleBoost = prefersReducedMotion ? 1 : (0.9 + (0.1 * introBlend));

    if (!dragActive) {
      targetRotY += 0.0022;
    }

    const cameraDamping = prefersReducedMotion ? 0.22 : 0.065;
    const fovDamping = prefersReducedMotion ? 1 : 0.08;
    const lightDamping = prefersReducedMotion ? 0.3 : 0.08;
    const lookAtDamping = prefersReducedMotion ? 0.24 : 0.09;

    zoomSettleVelocity *= prefersReducedMotion ? 0 : 0.86;
    cameraCurrentZ += (cameraTargetZ - cameraCurrentZ) * cameraDamping;
    cameraCurrentZ += zoomSettleVelocity;
    camera.position.z = cameraCurrentZ;

    if (prefersReducedMotion) {
      cameraCurrentFov = cameraTargetFov;
    } else {
      cameraCurrentFov += (cameraTargetFov - cameraCurrentFov) * fovDamping;
    }
    if (Math.abs(camera.fov - cameraCurrentFov) > 0.001) {
      camera.fov = cameraCurrentFov;
      camera.updateProjectionMatrix();
    }

    lookAtCurrentY += (lookAtTargetY - lookAtCurrentY) * lookAtDamping;
    ambientLight.intensity += (ambientTargetIntensity - ambientLight.intensity) * lightDamping;
    keyLight.intensity += (keyTargetIntensity - keyLight.intensity) * lightDamping;

    Object.entries(models).forEach(([key, root]) => {
      if (!root) return;
      const state = modelStates[key];
      if (!state) return;

      const isActive = key === activeModelKey;

      state.currentX += (state.targetX - state.currentX) * 0.12;
      state.currentScale += (state.targetScale - state.currentScale) * 0.11;
      state.currentY += (state.targetY - state.currentY) * 0.12;
      state.currentVisibility += (state.targetVisibility - state.currentVisibility) * 0.11;

      if (state.currentVisibility <= 0.02) {
        root.visible = false;
        return;
      }
      root.visible = true;

      root.position.x = state.currentX;
      root.position.y = state.currentY + Math.sin(t * 1.2 + state.phase) * 0.014;
      root.scale.setScalar(state.currentScale * introScaleBoost);

      const focusFactor = isActive ? 1 : 0.62;
      const rotTarget = (targetRotY * focusFactor) + state.targetRotOffset;
      root.rotation.y += (rotTarget - root.rotation.y) * 0.1;

      root.traverse((node) => {
        if (!node.isMesh || !node.material) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((mat) => {
          if (!mat || !mat.userData) return;
          const baseOpacity = typeof mat.userData.baseOpacity === 'number' ? mat.userData.baseOpacity : 1;
          const nextOpacity = baseOpacity * introBlend * state.currentVisibility;
          if (Math.abs((mat.opacity ?? 0) - nextOpacity) > 0.002) {
            mat.opacity = nextOpacity;
            mat.needsUpdate = true;
          }
          if (introBlend > 0.985 && baseOpacity >= 0.999) {
            mat.transparent = false;
          }
        });
      });

      if (mixers[key]) {
        mixers[key].update(delta);
      } else if (limbRigs[key] && limbRigs[key].length > 0) {
        for (const entry of limbRigs[key]) {
          const wave = Math.sin(t * 2.4);
          const side = (entry.type === 'armR' || entry.type === 'legR') ? -1 : 1;
          const amp = isActive ? 1 : 0.65;

          if (entry.type.includes('arm')) {
            entry.bone.rotation.x = entry.baseX + (wave * 0.12 * side * amp);
            entry.bone.rotation.z = entry.baseZ + (Math.cos(t * 2.4) * 0.06 * side * amp);
          } else {
            entry.bone.rotation.x = entry.baseX - (wave * 0.1 * side * amp);
          }
        }
      }
    });

    camera.lookAt(0, lookAtCurrentY, 0);
    renderer.render(scene, camera);
  };

  const startAnimation = () => {
    if (isAnimating) return;
    isAnimating = true;
    clock.start();
    animate();
  };

  const stopAnimation = () => {
    if (!isAnimating) return;
    isAnimating = false;
    cancelAnimationFrame(rafId);
    clock.stop();
  };

  const handleVisibility = () => {
    if (document.hidden) {
      stopAnimation();
    } else {
      startAnimation();
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);
  startAnimation();
})();
