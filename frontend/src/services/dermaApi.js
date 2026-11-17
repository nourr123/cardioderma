import axios from "axios";

const AI_URL = import.meta.env.VITE_AI_URL || "http://127.0.0.1:8000";

export const dermaApi = {
  async analyze(file) {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await axios.post(`${AI_URL}/predict`, formData);
    return data;
  },
  // alias au cas où SkinAnalysis.jsx appelle predict()
  async predict(file) {
    return this.analyze(file);
  },
};