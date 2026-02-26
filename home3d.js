(() => {
  const container = document.querySelector('#stlScene');
  if (!container) return;

  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.Fog(0xe2e2e2, 10, 28);

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
  renderer.shadowMap.enabled = true;
  if ('PCFSoftShadowMap' in THREE) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  if ('outputEncoding' in renderer && 'sRGBEncoding' in THREE) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }
  if ('toneMapping' in renderer && 'ACESFilmicToneMapping' in THREE) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.domElement.style.background = 'transparent';
  container.style.background = 'transparent';
  container.appendChild(renderer.domElement);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.06);
  keyLight.position.set(2.2, 4.8, 4.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.00003;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.42);
  scene.add(ambientLight);

  const rimLight = new THREE.DirectionalLight(0xf3f6ff, 0.34);
  rimLight.position.set(-2.8, 2.2, -3.4);
  scene.add(rimLight);

  const sweaterSpotlight = new THREE.SpotLight(0xffffff, 2.42, 17, Math.PI / 9.5, 0.37, 1.28);
  sweaterSpotlight.position.set(0, 3.85, 1.9);
  sweaterSpotlight.castShadow = true;
  sweaterSpotlight.shadow.mapSize.set(2048, 2048);
  sweaterSpotlight.shadow.bias = -0.00003;
  sweaterSpotlight.shadow.normalBias = 0.018;
  sweaterSpotlight.shadow.radius = 2;
  scene.add(sweaterSpotlight);
  scene.add(sweaterSpotlight.target);


  const createConcreteTexture = (size, minBase, maxBase, crackDensity) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const image = ctx.createImageData(size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      const shade = minBase + Math.random() * (maxBase - minBase);
      const grain = (Math.random() - 0.5) * 26;
      const channel = Math.max(0, Math.min(255, shade + grain));
      image.data[i] = channel;
      image.data[i + 1] = channel;
      image.data[i + 2] = channel;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);

    ctx.globalAlpha = 0.12;
    for (let i = 0; i < crackDensity; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 20 + Math.random() * 120;
      const angle = Math.random() * Math.PI * 2;
      ctx.strokeStyle = Math.random() > 0.6 ? '#f0f0f0' : '#5c5c5c';
      ctx.lineWidth = 0.3 + Math.random() * 1.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  };

  const wallMap = createConcreteTexture(512, 220, 244, 28);
  const floorMap = createConcreteTexture(512, 196, 226, 36);
  if (wallMap) wallMap.repeat.set(3.6, 2.4);
  if (floorMap) floorMap.repeat.set(5.2, 5.2);

  const room = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      map: floorMap || null,
      roughnessMap: floorMap || null,
      roughness: 0.96,
      metalness: 0.02
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.22;
  floor.receiveShadow = true;
  room.add(floor);

  const chamberMaterial = new THREE.MeshStandardMaterial({
    color: 0xf7f7f7,
    map: wallMap || null,
    roughnessMap: wallMap || null,
    roughness: 0.9,
    metalness: 0.01,
    side: THREE.BackSide
  });

  // Curved rear chamber to avoid box-shaped room feeling.
  const chamberShell = new THREE.Mesh(
    new THREE.CylinderGeometry(7.1, 7.1, 9.2, 64, 1, true, Math.PI - 1.22, 2.44),
    chamberMaterial
  );
  chamberShell.position.set(0, 2.2, 1.8);
  room.add(chamberShell);

  const chamberCeiling = new THREE.Mesh(
    new THREE.SphereGeometry(7.12, 42, 28, Math.PI - 1.2, 2.4, 0, Math.PI * 0.52),
    chamberMaterial
  );
  chamberCeiling.position.set(0, 1.48, 1.8);
  room.add(chamberCeiling);

  const chamberFloorCurve = new THREE.Mesh(
    new THREE.TorusGeometry(4.2, 0.12, 18, 96, Math.PI * 1.1),
    new THREE.MeshStandardMaterial({
      color: 0xd8d8d8,
      roughness: 0.52,
      metalness: 0.24
    })
  );
  chamberFloorCurve.rotation.x = Math.PI / 2;
  chamberFloorCurve.rotation.z = Math.PI;
  chamberFloorCurve.position.set(0, -1.02, -3.56);
  room.add(chamberFloorCurve);

  const ceilingRail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 5.6, 18),
    new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.4, metalness: 0.42 })
  );
  ceilingRail.rotation.z = Math.PI / 2;
  ceilingRail.position.set(0, 3.42, -1.1);
  ceilingRail.castShadow = true;
  room.add(ceilingRail);



  // Keep garment model scale unchanged; scale only the fitting-room background.
  room.scale.set(0.92, 0.92, 0.92);
  room.position.set(0, -0.02, -0.62);

  scene.add(room);

  // Wireframe hologram structure inspired by futuristic cage forms.
  const hologramGroup = new THREE.Group();
  const holoColor = 0xc7d8ff;
  const holoLayers = [];

  const makeWire = (geometry, opacity) => {
    const material = new THREE.MeshBasicMaterial({
      color: holoColor,
      wireframe: true,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    material.userData.baseOpacity = opacity;
    holoLayers.push(material);
    return new THREE.Mesh(geometry, material);
  };

  const holoOuter = makeWire(new THREE.TorusGeometry(2.8, 0.88, 30, 92), 0.56);
  holoOuter.rotation.x = Math.PI / 2;
  hologramGroup.add(holoOuter);

  hologramGroup.position.set(0, 0.26, -1.16);
  hologramGroup.scale.set(1.1, 1.1, 1.1);
  scene.add(hologramGroup);

  const ambientDefault = 0.42;
  const ambientFocus = 0.36;
  const keyDefault = 1.06;
  const keyFocus = 1.24;
  const spotDefault = 2.18;
  const spotFocus = 2.96;
  let ambientTargetIntensity = ambientDefault;
  let keyTargetIntensity = keyDefault;
  let spotTargetIntensity = spotDefault;
  let spotFocusBlend = 0;
  let holoFocusBlend = 0;

  if (window.location.protocol === 'file:') {
    setStatus('Run with local server (not file://)');
    return;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const supportsPointerEvents = 'PointerEvent' in window;
  const isMobilePortrait = window.matchMedia('(max-width: 480px) and (orientation: portrait)').matches;
  const mobilePortraitScaleFactor = isMobilePortrait ? 0.7 : 1;

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
      'assets/models/mw1.glb',
      'assets/models/mw1.glb'
    ],
    sweater: [
      'assets/models/sweater.glb',
      'assets/models/sweater1.glb'
    ],
    sweater2: [
      'assets/models/sweater2.glb'
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
  let rotateModelKey = null;
  let zoomSettleVelocity = 0;

  const pickModelKeyAtPointer = (clientX, clientY) => {
    const rect = container.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node) {
        if (node.userData && node.userData.modelKey) {
          return node.userData.modelKey;
        }
        node = node.parent;
      }
    }
    return null;
  };

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

  const applyFocus = (key) => {
    activeModelKey = (key && key in modelSources) ? key : null;
    const modelKeys = Object.keys(modelStates);

    if (!showAllModels) {
      cameraTargetZ = soloCameraZ;
      cameraTargetFov = soloFov;
      lookAtTargetY = zoomLookAtY;
      ambientTargetIntensity = ambientDefault;
      keyTargetIntensity = keyDefault;
      spotTargetIntensity = spotDefault;

      Object.entries(modelStates).forEach(([name, state]) => {
        const isSweaterPrimary = name === 'sweater';
        state.targetX = isSweaterPrimary ? 0 : -2.8;
        state.targetScale = state.baseScale * (isSweaterPrimary ? 1.02 : 0.001);
        state.targetRotOffset = isSweaterPrimary ? 0 : -0.2;
        state.targetY = state.baseY + (isSweaterPrimary ? 0.08 : 0);
        state.targetVisibility = isSweaterPrimary ? 1 : 0;
      });
      return;
    }

    if (!activeModelKey) {
      cameraTargetZ = defaultCameraZ;
      cameraTargetFov = defaultFov;
      lookAtTargetY = defaultLookAtY;
      ambientTargetIntensity = ambientDefault;
      keyTargetIntensity = keyDefault;
      spotTargetIntensity = spotDefault;
    } else {
      cameraTargetZ = zoomCameraZ;
      cameraTargetFov = zoomFov;
      lookAtTargetY = zoomLookAtY;
      ambientTargetIntensity = ambientFocus;
      keyTargetIntensity = keyFocus;
      spotTargetIntensity = spotFocus;
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
      state.targetScale = state.baseScale * (isActive ? 1.15 : 0.54);
      state.targetRotOffset = isActive ? 0 : (state.targetX < 0 ? -0.3 : 0.3);
      state.targetY = state.baseY + (isActive ? 0.48 : 0.03);
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
    if (showAllModels && !activeModelKey) {
      const pickedKey = pickModelKeyAtPointer(event.clientX, event.clientY);
      if (pickedKey) rotateModelKey = pickedKey;
    }
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
    targetRotY += deltaX * (isCoarsePointer ? 0.0068 : 0.01);
  };

  const onPointerEnd = (event) => {
    if (dragActive && !dragMoved) {
      const hitKey = pickModelKeyAtPointer(event.clientX, event.clientY);

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
          rotateModelKey = null;
          zoomSettleVelocity = prefersReducedMotion ? 0 : 0.08;
        } else {
          rotateModelKey = hitKey;
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

  if (supportsPointerEvents) {
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerEnd);
    container.addEventListener('pointercancel', onPointerEnd);
    container.addEventListener('pointerleave', onPointerLeave);
  } else {
    container.addEventListener(
      'touchstart',
      (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        onPointerDown({ clientX: touch.clientX, clientY: touch.clientY, pointerId: -1 });
      },
      { passive: true }
    );
    container.addEventListener(
      'touchmove',
      (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        onPointerMove({ clientX: touch.clientX, clientY: touch.clientY });
      },
      { passive: true }
    );
    container.addEventListener(
      'touchend',
      (event) => {
        const touch = event.changedTouches?.[0];
        if (!touch) return;
        onPointerEnd({ clientX: touch.clientX, clientY: touch.clientY, pointerId: -1 });
      },
      { passive: true }
    );
    container.addEventListener('touchcancel', onPointerLeave, { passive: true });
  }

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
                child.castShadow = true;
                child.receiveShadow = true;
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

            const desiredHeight = 1.02 * mobilePortraitScaleFactor;
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
              baseY: -0.4,
              currentY: -0.4,
              targetY: -0.4,
              currentVisibility: key === 'sweater' ? 1 : 0,
              targetVisibility: key === 'sweater' ? 1 : 0,
              targetRotOffset: 0,
              phase: Math.random() * Math.PI * 2
            };

            scene.add(root);

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
      targetRotY += isCoarsePointer ? 0.0015 : 0.0022;
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
    sweaterSpotlight.intensity += (spotTargetIntensity - sweaterSpotlight.intensity) * (prefersReducedMotion ? 0.25 : 0.11);

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

      const rotTarget = activeModelKey
        ? (isActive ? (targetRotY + state.targetRotOffset) : state.targetRotOffset)
        : ((showAllModels && rotateModelKey)
          ? (key === rotateModelKey ? (targetRotY + state.targetRotOffset) : state.targetRotOffset)
          : ((targetRotY * (isActive ? 1 : 0.62)) + state.targetRotOffset));
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

    const holoKey = (activeModelKey && modelStates[activeModelKey]) ? activeModelKey : 'sweater';
    const holoState = modelStates[holoKey] || modelStates.sweater;
    const holoFocused = Boolean(activeModelKey && modelStates[activeModelKey]);
    const holoBlendDamping = prefersReducedMotion ? 0.2 : 0.06;
    holoFocusBlend += ((holoFocused ? 1 : 0) - holoFocusBlend) * holoBlendDamping;
    if (holoState) {
      const holoPulse = (prefersReducedMotion || holoFocused) ? 1 : (1 + (Math.sin(t * 1.45) * 0.04));
      const targetHoloX = holoState.currentX;
      const targetHoloY = holoState.currentY + (holoFocused ? 0.24 : 0.38);
      const targetHoloZ = holoFocused ? -1.38 : -1.2;
      const holoMoveDamping = prefersReducedMotion ? 0.18 : 0.1;
      hologramGroup.position.x += (targetHoloX - hologramGroup.position.x) * holoMoveDamping;
      hologramGroup.position.y += (targetHoloY - hologramGroup.position.y) * holoMoveDamping;
      hologramGroup.position.z += (targetHoloZ - hologramGroup.position.z) * holoMoveDamping;
      const targetRotX = (prefersReducedMotion || holoFocused) ? 0 : (Math.sin(t * 0.65) * 0.035);
      hologramGroup.rotation.x += (targetRotX - hologramGroup.rotation.x) * 0.08;
      const targetRotYSpeed = (prefersReducedMotion || holoFocused) ? 0.00022 : 0.0024;
      hologramGroup.rotation.y += targetRotYSpeed;
      const holoScale = ((holoFocused ? 1.01 : 1.1) + (holoFocusBlend * 0.024)) * holoPulse;
      const nextScale = hologramGroup.scale.x + ((holoScale - hologramGroup.scale.x) * 0.08);
      hologramGroup.scale.set(nextScale, nextScale, nextScale);
      const holoOpacityFactor = 1 - (holoFocusBlend * 0.99);
      holoLayers.forEach((material) => {
        const baseOpacity = typeof material.userData.baseOpacity === 'number' ? material.userData.baseOpacity : 0.4;
        const targetOpacity = baseOpacity * holoOpacityFactor;
        material.opacity += (targetOpacity - material.opacity) * 0.1;
      });
    }

    const spotlightKey = (activeModelKey && modelStates[activeModelKey]) ? activeModelKey : 'sweater';
    const spotlightState = modelStates[spotlightKey] || modelStates.sweater;
    if (spotlightState) {
      const focused = Boolean(activeModelKey && modelStates[activeModelKey]);
      spotFocusBlend += ((focused ? 1 : 0) - spotFocusBlend) * (prefersReducedMotion ? 0.3 : 0.08);
      const modelYaw = models[spotlightKey]?.rotation?.y || 0;
      const yawFollow = Math.max(-0.16, Math.min(0.16, modelYaw * 0.18));
      const spotlightTargetX = spotlightState.currentX + yawFollow;
      const spotlightTargetY = spotlightState.currentY + 0.28;
      const spotlightTargetZ = -0.06;
      const lightHeadX = spotlightState.currentX * 0.32;
      const lightHeadY = 3.85 + (spotFocusBlend * 0.08);
      const lightHeadZ = 1.9;
      sweaterSpotlight.position.x += (lightHeadX - sweaterSpotlight.position.x) * 0.09;
      sweaterSpotlight.position.y += (lightHeadY - sweaterSpotlight.position.y) * 0.09;
      sweaterSpotlight.position.z += (lightHeadZ - sweaterSpotlight.position.z) * 0.09;
      sweaterSpotlight.target.position.x += (spotlightTargetX - sweaterSpotlight.target.position.x) * 0.14;
      sweaterSpotlight.target.position.y += (spotlightTargetY - sweaterSpotlight.target.position.y) * 0.14;
      sweaterSpotlight.target.position.z += (spotlightTargetZ - sweaterSpotlight.target.position.z) * 0.14;
      sweaterSpotlight.angle = (Math.PI / 10.4) - (spotFocusBlend * 0.055);
      sweaterSpotlight.penumbra = 0.34 + (spotFocusBlend * 0.1);
    }

    camera.lookAt(0, lookAtCurrentY, 0);
    renderer.clear();
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
