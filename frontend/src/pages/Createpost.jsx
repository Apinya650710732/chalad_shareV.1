import React, { useEffect, useRef, useState } from "react"; 
import { useNavigate } from "react-router-dom";
import axios from "axios";

import "../component/Createpost.css";
import Sidebar from "./Sidebar";
import Footer from "../component/Footer";

const MAX_FILE_MB = 30; // จำกัดขนาดไฟล์ 10MB
const ACCEPTED_MIME = ["application/pdf"];

const MAX_COVER_MB = 5;
const ACCEPTED_COVER_MIME = ["image/jpeg", "image/png"];

function parseTags(input) {
  return input
    .split(/[,\s]+/g)
    .map((t) => t.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean);
}

const CreatePost = () => {
  const [formData, setForm] = useState({
    title: "",
    description: "",
    tags: "",
    visibility: "public",
    file: null,
    cover: null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const coverInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [coverPreviewUrl]);

  const handleChange = (e) => {
    setForm({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCoverChange = (e) => {
    setErrorMsg("");
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    const sizeMB = f.size / (1024 * 1024);
    if (!ACCEPTED_COVER_MIME.includes(f.type)) {
      setErrorMsg("รองรับเฉพาะรูปภาพ .jpg .png สำหรับหน้าปก");
      e.target.value = "";
      return;
    }
    if (sizeMB > MAX_COVER_MB) {
      setErrorMsg(`ไฟล์หน้าปกใหญ่เกินไป (สูงสุด ${MAX_COVER_MB} MB)`);
      e.target.value = "";
      return;
    }

    // ทำ preview
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverPreviewUrl(URL.createObjectURL(f));

    setForm({ ...formData, cover: f });
  };

  // เลือกไฟล์ + ตรวจสอบชนิด+ขนาด
  const handleFileChange = (e) => {
    setErrorMsg("");
    const f = e.target.files && e.target.files[0];
    if (!f) return;

    const sizeMB = f.size / (1024 * 1024);
    if (!ACCEPTED_MIME.includes(f.type)) {
      setErrorMsg("รองรับเฉพาะไฟล์ .pdf เท่านั้น");
      e.target.value = "";
      return;
    }
    if (sizeMB > MAX_FILE_MB) {
      setErrorMsg(`ไฟล์ใหญ่เกินไป (สูงสุด ${MAX_FILE_MB} MB)`);
      e.target.value = "";
      return;
    }
    setForm({ ...formData, file: f });
  };

  // เพิ่ม: ล้างหน้าปก
  const clearCover = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverPreviewUrl("");
    setForm((prev) => ({ ...prev, cover: null }));
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  // เพิ่ม: ล้างไฟล์ pdf
  const clearFile = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setForm((prev) => ({ ...prev, file: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // โพสต์
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.title.trim()) {
      setErrorMsg("กรุณากรอกหัวข้อ");
      return;
    }
    if (!formData.cover) {
      setErrorMsg("กรุณาอัปโหลดรูปหน้าปก");
      return;
    }
    if (!formData.file) {
      setErrorMsg("กรุณาอัปโหลดไฟล์ .pdf");
      return;
    }

    try {
      setIsLoading(true);
      let coverUrl = null;

      if (formData.cover) {
        const coverData = new FormData();
        coverData.append("file", formData.cover);

        const coverRes = await axios.post("/files/cover", coverData, {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        });

        coverUrl = coverRes.data && coverRes.data.cover_url;
        if (!coverUrl) {
          throw new Error("ไม่พบ cover_url จากการอัปโหลดหน้าปก");
        }
      }

      // อัปโหลดไฟล์ PDF
      const fileData = new FormData();
      fileData.append("file", formData.file);
      const uploadRes = await axios.post("/files/doc", fileData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const documentId = uploadRes.data && uploadRes.data.document_id;
      if (!documentId) throw new Error("ไม่พบ document_id จากการอัปโหลด");

      // สร้างโพสต์
      const postData = {
        post_title: formData.title.trim(),
        post_description: formData.description.trim(),
        post_visibility: formData.visibility,
        document_id: documentId,
        cover_url: coverUrl,
        tags: parseTags(formData.tags),
      };

      await axios.post("/posts", postData, { withCredentials: true });
      alert("โพสต์สำเร็จ!");
      handleCancel();
    } catch (err) {
      if (err && err.response && err.response.status === 401) {
        return navigate("/login", { replace: true });
      }
      console.error("Create post error:", err);
      setErrorMsg(
        (err.response && err.response.data && err.response.data.error) ||
          err.message ||
          "เกิดข้อผิดพลาดในการโพสต์"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverPreviewUrl("");

    setForm({
      title: "",
      description: "",
      tags: "",
      visibility: "public",
      file: null,
      cover: null,
    });
    setErrorMsg("");

    if (coverInputRef.current) coverInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";

    navigate("/home");
  };

  return (
    <div className="create-page">
      <Sidebar />
      <div className="create-post-container">
        <h2 className="create-title">สร้างโพสต์ใหม่</h2>

        <form className="create-form" onSubmit={handleSubmit}>
          {/* หัวข้อ + visibility */}
          <div className="form-group">
            <label>
              หัวข้อ<span className="required">*</span>
            </label>
            <div className="title-row">
              <input
                type="text"
                name="title"
                placeholder="พิมพ์หัวข้อของคุณ..."
                value={formData.title}
                onChange={handleChange}
                disabled={isLoading}
              />
              <select
                name="visibility"
                value={formData.visibility}
                onChange={handleChange}
                disabled={isLoading}
              >
                <option value="public">สาธารณะ</option>
                <option value="friends">เฉพาะเพื่อน</option>
              </select>
            </div>
          </div>

          {/* แสดง error (คงไว้เหมือนเดิม/ถ้าบีมอยากโชว์) */}
          {errorMsg ? (
            <div style={{ color: "red", marginBottom: 12 }}>{errorMsg}</div>
          ) : null}

          {/* อัปโหลดหน้าปก */}
          <div className="form-group">
            <label>
              รูปหน้าปก<span className="required">*</span>
            </label>
            <div className="upload-box">
              <input
                ref={coverInputRef}
                type="file"
                id="cover-upload"
                onChange={handleCoverChange}
                accept="image/*"
                disabled={isLoading}
              />

              {/* ปุ่มล้างหน้าปก */}
              {formData.cover ? (
                <button
                  type="button"
                  className="create-clear-btn"
                  onClick={clearCover}
                  disabled={isLoading}
                  aria-label="ล้างรูปหน้าปก"
                >
                  ✕
                </button>
              ) : null}

              <label htmlFor="cover-upload" className="upload-label">
                {formData.cover ? (
                  <>
                    {/* preview รูป */}
                    {coverPreviewUrl ? (
                      <img
                        src={coverPreviewUrl}
                        alt="cover preview"
                        className="create-cover-preview"
                      />
                    ) : null}
                    <span>{formData.cover.name}</span>
                  </>
                ) : (
                  <>
                    {/* ไอคอนเดิมยังอยู่ */}
                    <img
                      src="https://cdn-icons-png.flaticon.com/512/1829/1829586.png"
                      alt="cover"
                      className="upload-icon"
                    />
                    <p>เพิ่มรูปหน้าปก</p>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* อัปโหลดไฟล์ */}
          <div className="form-group">
            <label>
              อัปโหลดไฟล์<span className="required">*</span>
            </label>
            <div className="upload-box">
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                onChange={handleFileChange}
                accept=".pdf,application/pdf"
                disabled={isLoading}
              />

              {/* ปุ่มล้างไฟล์ pdf */}
              {formData.file ? (
                <button
                  type="button"
                  className="create-clear-btn"
                  onClick={clearFile}
                  disabled={isLoading}
                  aria-label="ล้างไฟล์ PDF"
                >
                  ✕
                </button>
              ) : null}

              <label htmlFor="file-upload" className="upload-label">
                {formData.file ? (
                  <span>{formData.file.name}</span>
                ) : (
                  <>
                    {/* ไอคอนเดิมยังอยู่ */}
                    <img
                      src="https://cdn-icons-png.flaticon.com/512/864/864685.png"
                      alt="upload"
                      className="upload-icon"
                    />
                    <p>เพิ่มไฟล์</p>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* คำอธิบาย (กลับมาเหมือนเดิม) */}
          <div className="form-group">
            <label>คำอธิบาย</label>
            <textarea
              name="description"
              placeholder="เพิ่มรายละเอียดเกี่ยวกับโพสต์ของคุณ..."
              value={formData.description}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          {/* แท็ก (กลับมาเหมือนเดิม) */}
          <div className="form-group">
            <label>
              แท็ก<span className="required">*</span>
            </label>
            <input
              type="text"
              name="tags"
              placeholder="เช่น #uml #se หรือ uml,se"
              value={formData.tags}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          {/* ปุ่ม */}
          <div className="button-group">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleCancel}
              disabled={isLoading}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={isLoading || !formData.title.trim() || !formData.file}
            >
              {isLoading ? "กำลังโพสต์..." : "โพสต์"}
            </button>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
};

export default CreatePost;
