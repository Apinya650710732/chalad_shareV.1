// หน้า .jsx (ทำ prefix แล้ว)

import React, { useEffect, useState } from "react";
import { IoSearch } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import Sidebar from "./Sidebar";
import axios from "axios";
import Footer from "../component/Footer";
import picdefault from "../assets/default.png";
import "../component/Friends.css";

const API_HOST = "http://localhost:8080";
// const API_ORIGIN = process.env.REACT_APP_API_ORIGIN || window.location.origin;

const toAbsUrl = (p) => {
  if (!p) return "";
  if (p.startsWith("http")) return p;
  const clean = p.replace(/^\.\//, "").replace(/^\./, "");
  return `${API_HOST}${clean.startsWith("/") ? clean : `/${clean}`}`;
};

const Friends = () => {
  const [ownerId, setOwnerId] = useState(null);
  const [activeTab, setActiveTab] = useState("my");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const size = 20;
  const [friends, setFriends] = useState([]);
  const [totalFriends, setTotalFriends] = useState(0);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [incoming, setIncoming] = useState([]);
  const [loadingReq, setLoadingReq] = useState(false);

  //Add friend
  const [addQuery, setAddQuery] = useState("");
  const [addPage, setAddPage] = useState(1);
  const [addUsers, setAddUsers] = useState([]);
  const [addTotal, setAddTotal] = useState(0);
  const [loadingAdd, setLoadingAdd] = useState(false);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const { data } = await axios.get("/profile");
        const id = data.user_id || data.id;
        if (id) setOwnerId(id);
      } catch (err) {
        console.error("Fetch profile failed", err);
      }
    };
    fetchMe();
  }, []);

  const fetchFriends = async (q = query, p = page) => {
    if (!ownerId) return;
    setLoadingFriends(true);
    try {
      const { data } = await axios.get(`/social/friends/${ownerId}`, {
        params: { search: q, page: p, size },
      });
      setFriends(data.items || []);
      setTotalFriends(data.total || 0);
    } catch (e) {
      console.error("listFriends:", e);
      alert("โหลดรายชื่อเพื่อนไม่สำเร็จ");
    } finally {
      setLoadingFriends(false);
    }
  };

  const unfriend = async (targetId) => {
    try {
      await axios.delete(`/social/friends/${targetId}`);
      setFriends((prev) => prev.filter((it) => it.user_id !== targetId));
      setTotalFriends((t) => Math.max(0, t - 1));
    } catch (e) {
      console.error("unfriend:", e);
      alert("ลบเพื่อนไม่สำเร็จ");
    }
  };

  const fetchIncoming = async () => {
    setLoadingReq(true);
    try {
      const { data } = await axios.get(`/social/requests/incoming`, {
        params: { page: 1, size: 50 },
      });
      setIncoming(data.items || []);
    } catch (e) {
      console.error("incoming:", e);
      alert("โหลดคำขอเป็นเพื่อนไม่สำเร็จ");
    } finally {
      setLoadingReq(false);
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      await axios.post(`/social/requests/${requestId}/accept`);
      setIncoming((prev) => prev.filter((r) => r.request_id !== requestId));
      fetchFriends(); // รีโหลดเพื่อน
    } catch (e) {
      console.error("accept:", e);
      alert("ยอมรับคำขอไม่สำเร็จ");
    }
  };

  const declineRequest = async (requestId) => {
    try {
      await axios.post(`/social/requests/${requestId}/decline`);
      setIncoming((prev) => prev.filter((r) => r.request_id !== requestId));
    } catch (e) {
      console.error("decline:", e);
      alert("ปฏิเสธคำขอไม่สำเร็จ");
    }
  };

  const fetchAddFriends = async (q = addQuery, p = addPage) => {
    const qq = (q || "").trim();
    if (qq.length === 0) {
      setAddUsers([]);
      setAddTotal(0);
      return;
    }
    setLoadingAdd(true);
    try {
      const { data } = await axios.get(`/social/addfriends`, {
        params: { search: qq, page: p, size },
      });
      setAddUsers(data.items || []);
      setAddTotal(data.total || 0);
    } catch (e) {
      console.error("add-friends:", e);
      alert("ค้นหาเพื่อนไม่สำเร็จ");
    } finally {
      setLoadingAdd(false);
    }
  };

  const sendRequest = async (targetId) => {
    try {
      await axios.post(`/social/requests`, { to_user_id: targetId });
      setAddUsers((prev) => prev.filter((u) => u.user_id !== targetId));
      setAddTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      console.error("sendRequest:", e);
      alert("ส่งคำขอเป็นเพื่อนไม่สำเร็จ");
    }
  };

  useEffect(() => {
    if (ownerId) {
      fetchIncoming();
      if (activeTab === "my") fetchFriends();
    }
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId) return;
    if (activeTab === "my") fetchFriends();
    if (activeTab === "requests") fetchIncoming();
    if (activeTab === "add") {
      setAddQuery("");
      setAddUsers([]);
      setAddTotal(0);
      setAddPage(1);
    }
  }, [activeTab, ownerId]);

  useEffect(() => {
    if (activeTab !== "my" || !ownerId) return;
    const t = setTimeout(() => {
      const q = query.trim();
      setPage(1);
      fetchFriends(q, 1);
    }, 300);
    return () => clearTimeout(t);
  }, [query, ownerId, activeTab]);

  useEffect(() => {
    if (!ownerId) return;
    if (activeTab !== "add") return;

    const t = setTimeout(() => {
      const q = addQuery.trim();

      if (q.length === 0) {
        setAddUsers([]);
        setAddTotal(0);
        setAddPage(1);
        return;
      }

      if (addPage === 1) {
        fetchAddFriends(q, 1);
      } else {
        setAddPage(1);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [addQuery, ownerId, activeTab]);

  useEffect(() => {
    if (!ownerId) return;
    if (activeTab !== "my") return;
    fetchFriends(query, page);
  }, [page]);

  useEffect(() => {
    if (!ownerId) return;
    if (activeTab !== "add") return;

    const q = addQuery.trim();
    if (q.length === 0) return;

    fetchAddFriends(q, addPage);
  }, [addPage, ownerId, activeTab]);

  const totalPages = Math.max(1, Math.ceil(totalFriends / size));
  const navigate = useNavigate();

  return (
    <div className="friends-page">
      <div className="friends-container">
        <Sidebar />

        <main className="friends-main">
          {/* ===== Top bar: หัวข้อ + ปุ่ม + ค้นหา ===== */}
          <div className="friends-topbar">
            <div className="friends-top-left">
              {(activeTab === "add" || activeTab === "requests") && (
                <button
                  type="button"
                  className="back-btn"
                  onClick={() => setActiveTab("my")}
                  aria-label="ย้อนกลับ"
                >
                  {" "}
                  <FaArrowLeft />{" "}
                </button>
              )}

              <h2 className="friends-title">
                {activeTab === "my" && "เพื่อนของฉัน"}
                {activeTab === "add" && "เพิ่มเพื่อน"}
                {activeTab === "requests" && "คำขอเป็นเพื่อน"}
              </h2>

              <div className="friends-actions">
                <button
                  type="button"
                  className={`friends-pill friends-pill--green ${
                    activeTab === "add" ? "is-active" : ""
                  }`}
                  onClick={() => setActiveTab("add")}
                >
                  เพิ่มเพื่อน
                </button>

                <button
                  type="button"
                  className={`friends-pill friends-pill--outline ${
                    activeTab === "requests" ? "is-active" : ""
                  }`}
                  onClick={() => setActiveTab("requests")}
                >
                  คำขอ ({incoming.length})
                </button>
              </div>
            </div>

            {(activeTab === "my" || activeTab === "add") && (
              <div className="friends-search">
                <input
                  type="text"
                  placeholder={
                    activeTab === "my"
                      ? "ค้นหาเพื่อน"
                      : "ค้นหา username เพื่อเพิ่มเพื่อน"
                  }
                  value={activeTab === "my" ? query : addQuery}
                  onChange={(e) => {
                    if (activeTab === "my") setQuery(e.target.value);
                    else setAddQuery(e.target.value);
                  }}
                />
                <IoSearch className="friends-search-icon" />
              </div>
            )}
          </div>

          {/* ===== รายการเพื่อน (แท็บ my) ===== */}
          {activeTab === "my" && (
            <>
              {loadingFriends && (
                <div className="friends-placeholder">กำลังโหลด...</div>
              )}
              {!loadingFriends && (
                <>
                  <ul className="friends-list">
                    {friends.map((f) => (
                      <li key={f.user_id} className="friends-item">
                        <div className="friends-left">
                          <img
                            className="friends-avatar"
                            src={toAbsUrl(f.avatar) || picdefault}
                            alt={`${f.username || f.user_id} avatar`}
                            onError={(e) => (e.currentTarget.src = picdefault)}
                          />
                          <div className="friends-name">
                            <span className="friends-name-main">
                              {f.username || `user#${f.user_id}`}
                            </span>
                          </div>
                        </div>

                        <button
                          className="friends-remove"
                          onClick={() => unfriend(f.user_id)}
                        >
                          ลบเพื่อน
                        </button>
                      </li>
                    ))}
                    {!loadingFriends && friends.length === 0 && (
                      <div className="friends-placeholder">
                        ไม่มีเพื่อนที่ตรงกับคำค้น
                      </div>
                    )}
                  </ul>

                  {Number.isFinite(totalFriends) && totalPages > 1 && (
                    <div className="friends-pagination">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        ก่อนหน้า
                      </button>
                      <span>
                        {page} / {totalPages}
                      </span>
                      <button
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        ถัดไป
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ===== แท็บคำขอ ===== */}
          {activeTab === "requests" && (
            <>
              {loadingReq && (
                <div className="friends-placeholder">กำลังโหลดคำขอ...</div>
              )}
              {!loadingReq && (
                <ul className="friends-list">
                  {incoming.map((r) => (
                    <li key={r.request_id} className="friends-item">
                      <div className="friends-left">
                        <img
                          className="friends-avatar"
                          src={
                            toAbsUrl(r.avatar) ||
                            picdefault /* ถ้า backend ใช้ avatar_url → เปลี่ยนเป็น r.avatar_url */
                          }
                          alt={`req-${r.request_id}`}
                          onError={(e) => (e.currentTarget.src = picdefault)}
                        />
                        <div className="friends-name">
                          <span className="friends-name-main">
                            {r.username || `user#${r.requester_user_id}`}
                          </span>
                        </div>
                      </div>

                      <div className="friends-actions-right">
                        <button
                          className="friends-pill friends-pill--green"
                          onClick={() => acceptRequest(r.request_id)}
                        >
                          ยอมรับ
                        </button>
                        <button
                          className="friends-pill friends-pill--danger"
                          onClick={() => declineRequest(r.request_id)}
                        >
                          ปฏิเสธ
                        </button>
                      </div>
                    </li>
                  ))}
                  {incoming.length === 0 && (
                    <div className="friends-placeholder">
                      ยังไม่มีคำขอเข้ามา
                    </div>
                  )}
                </ul>
              )}
            </>
          )}
          {activeTab === "add" && (
            <>
              {loadingAdd && (
                <div className="friends-placeholder">กำลังค้นหา...</div>
              )}

              {!loadingAdd && addQuery.trim().length === 0 && (
                <div className="friends-placeholder">
                  พิมพ์ username เพื่อค้นหาผู้ใช้ที่ต้องการเพิ่มเป็นเพื่อน
                </div>
              )}

              {!loadingAdd && addQuery.trim().length > 0 && (
                <ul className="friends-list">
                  {addUsers.map((u) => (
                    <li key={u.user_id} className="friends-item">
                      <div className="friends-left">
                        <img
                          className="friends-avatar"
                          src={toAbsUrl(u.avatar) || picdefault}
                          alt={`${u.username || u.user_id} avatar`}
                          onError={(e) => (e.currentTarget.src = picdefault)}
                        />
                        <div className="friends-name">
                          <span className="friends-name-main">
                            {u.username || `user#${u.user_id}`}
                          </span>
                        </div>
                      </div>

                      <button
                        className="friends-pill friends-pill--green"
                        onClick={() => sendRequest(u.user_id)}
                      >
                        เพิ่มเพื่อน
                      </button>
                    </li>
                  ))}

                  {addUsers.length === 0 && (
                    <div className="friends-placeholder">
                      ไม่พบผู้ใช้ที่ตรงกับคำค้น
                    </div>
                  )}
                </ul>
              )}
            </>
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default Friends;
