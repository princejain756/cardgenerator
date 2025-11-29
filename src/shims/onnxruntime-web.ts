// Stub module to satisfy Vite bundling when onnxruntime-web is unavailable.
// If background removal is invoked, this will throw to indicate the runtime is missing.
const notAvailable = () => {
  throw new Error('onnxruntime-web is not available in this build.');
};

export default {
  InferenceSession: class {
    constructor() {
      notAvailable();
    }
  },
  env: {},
  Tensor: class {}
};
