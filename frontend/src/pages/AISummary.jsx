import React, { useRef, useState } from "react";
import Sidebar from "./Sidebar";
import Footer from "../component/Footer";

import "../component/AISummary.css";

const UploadIcon = () => (
  <svg width="48" height="48" viewBox="0 0 64 64" aria-hidden="true">
    <rect x="10" y="14" width="28" height="22" rx="3" fill="none" stroke="#0b5394" strokeWidth="2" />
    <rect x="26" y="26" width="28" height="22" rx="3" fill="none" stroke="#0b5394" strokeWidth="2" />
    <circle cx="20" cy="22" r="3" fill="#0b5394" opacity="0.9" />
    <path d="M14 34l7-7 6 6 5-4 6 5" fill="none" stroke="#0b5394" strokeWidth="2" strokeLinejoin="round" />
    <path d="M30 44l7-7 6 6 5-4 6 5" fill="none" stroke="#0b5394" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M32 6l4.5 16.5L53 27l-16.5 4.5L32 48l-4.5-16.5L11 27l16.5-4.5L32 6z" fill="#6ec1ff" />
    <path d="M50 38l2.6 9.2L62 50l-9.4 2.8L50 62l-2.6-9.2L38 50l9.4-2.8L50 38z" fill="#ff7aa2" />
  </svg>
);

// ngrok เปลี่ยนบ่อย แนะนำย้ายไป .env ทีหลัง
const API_URL = "https://unsmarting-kamari-arbored.ngrok-free.dev";

const AISummary = () => {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [summaryHtml, setSummaryHtml] = useState("");

  // เก็บ controller สำหรับยกเลิก request ก่อนหน้า
  const abortRef = useRef(null);

  const onPickFile = () => inputRef.current?.click();

  const uploadToAI = async (pdfFile) => {
    // ยกเลิก request เก่าถ้ายังวิ่งอยู่
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setErrorMsg("");
    setSummaryHtml("");

    try {
      const formData = new FormData();
      formData.append("file", pdfFile); // key = file ให้ตรง FastAPI

      const res = await fetch(`${API_URL}/summarize`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
        credentials: "omit",
        headers: {
          // "ngrok-skip-browser-warning": "true",
          Accept: "application/json",
        },
      });

      const ct = res.headers.get("content-type") || "";
      let data;

      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          res.ok
            ? "Response ไม่ใช่ JSON (อาจโดน ngrok warning/HTML แทรก)"
            : `HTTP ${res.status}: ${text.slice(0, 200)}`
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || "Upload failed");
      }

      setSummaryHtml(data?.summary_html || "");
    } catch (err) {
      // ถ้ายกเลิกเอง ไม่ต้องโชว์เป็น error
      if (err?.name === "AbortError") return;
      setErrorMsg(err?.message || "เกิดข้อผิดพลาดระหว่างอัปโหลด/สรุป");
    } finally {
      // เคลียร์เฉพาะตอน controller ตัวนี้ยังเป็นตัวล่าสุด
      if (abortRef.current === controller) {
        setIsLoading(false);
      }
    }
  };

  const onFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      alert("กรุณาเลือกไฟล์ PDF เท่านั้น");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setFile(f);

    //  กันเคสเลือกไฟล์เดิมซ้ำแล้ว onChange ไม่ยิง
    if (inputRef.current) inputRef.current.value = "";

    await uploadToAI(f);
  };

  const onClear = () => {
    setFile(null);
    setSummaryHtml("");
    setErrorMsg("");

    // ยกเลิก request ถ้ายังวิ่ง
    if (abortRef.current) abortRef.current.abort();

    if (inputRef.current) inputRef.current.value = "";
  };

  const onUploadKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPickFile();
    }
  };

  return (
    <div className="profile-page ai-page">
      <div className="profile-container">
        <Sidebar />

        <main className="profile-content">
          <div className="profile-shell">
            <div className="ai-layout">
              {/* LEFT */}
              <aside className="ai-source-panel">
                <div className="ai-left-title">AI ช่วยสรุป</div>
                <div className="ai-left-sub">แหล่งข้อมูล</div>

                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="ai-hidden"
                  onChange={onFileChange}
                />

                {!file ? (
                  <div
                    className="ai-upload"
                    role="button"
                    tabIndex={0}
                    onClick={onPickFile}
                    onKeyDown={onUploadKeyDown}
                    aria-label="อัปโหลดไฟล์ PDF"
                    title="คลิกเพื่ออัปโหลดไฟล์ PDF"
                  >
                    <div className="ai-upload-icon">
                      <UploadIcon />
                    </div>
                    <div className="ai-upload-text">เพิ่มไฟล์ PDF</div>
                  </div>
                ) : (
                  <div className="ai-file">
                    <div className="ai-file-row">
                      <div className="ai-file-name" title={file.name}>
                        {file.name}
                      </div>
                    </div>

                    <div className="ai-file-actions">
                      <button className="ai-btn ai-btn-ghost" type="button" onClick={onPickFile} disabled={isLoading}>
                        เปลี่ยนไฟล์
                      </button>
                      <button className="ai-btn ai-btn-danger" type="button" onClick={onClear} disabled={isLoading}>
                        ลบไฟล์
                      </button>
                    </div>

                    {isLoading && (
                      <div style={{ marginTop: 10, fontWeight: 800, color: "#0b5394" }}>
                        กำลังสรุป... (อาจใช้เวลาสักครู่)
                      </div>
                    )}
                    {errorMsg && (
                      <div style={{ marginTop: 10, fontWeight: 800, color: "#b42318" }}>
                        {errorMsg}
                      </div>
                    )}
                  </div>
                )}
              </aside>

              {/* RIGHT */}
              <section className="ai-output-panel">
                {!summaryHtml && (
                  <div className="ai-greet">
                    <div className="ai-greet-icon">
                      <SparkleIcon />
                    </div>

                    <div className="ai-greet-text">
                      <div className="ai-greet-title">สวัสดี, ฉันคือ AI ที่จะช่วยสรุปเนื้อหาของคุณ</div>
                      <div className="ai-greet-sub">อัปโหลดแหล่งข้อมูลแล้วเริ่มช่วยเหลือได้เลย</div>

                      {isLoading && (
                        <div style={{ marginTop: 12, fontWeight: 800, color: "#0b5394" }}>
                          กำลังประมวลผล กรุณารอสักครู่...
                        </div>
                      )}
                      {errorMsg && (
                        <div style={{ marginTop: 12, fontWeight: 800, color: "#b42318" }}>
                          {errorMsg}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {summaryHtml && (
                  <div className="ai-summary-render" dangerouslySetInnerHTML={{ __html: summaryHtml }} />
                )}
              </section>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default AISummary;
