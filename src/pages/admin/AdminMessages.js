import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [stats, setStats] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadMessages(currentPage);
    loadStats();
  }, [currentPage, filter]);

  const loadMessages = async (page) => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/messages?page=${page}&limit=10&status=${filter}`);
      if (response.success) {
        setMessages(response.data || []);
        setTotalPages(response.totalPages || 1);
        setCurrentPage(response.currentPage || 1);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get(`/admin/messages/stats`);
      if (response.success) {
        setStats(response.stats || {});
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) {
      toast.error("Reply message cannot be empty");
      return;
    }

    const loadingToast = toast.loading("Sending reply...");

    try {
      const response = await api.post('/admin/messages/reply', {
        id: selectedMessage._id,
        replyMessage: replyText
      });

      if (response.success) {
        toast.dismiss(loadingToast);
        toast.success("Reply sent successfully");

        setMessages(prev =>
          prev.map(msg =>
            msg._id === selectedMessage._id
              ? { ...msg, status: 'responded' }
              : msg
          )
        );

        setSelectedMessage(null);
        setReplyText('');
        loadStats();
      }
    } catch (error) {
      console.error("Reply error:", error);
      toast.dismiss(loadingToast);
      toast.error(error.message || "Failed to send reply");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusClass = (status) => {
    const base = "px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ";
    switch (status) {
      case 'new': return base + "bg-blue-100 text-blue-800";
      case 'read': return base + "bg-purple-100 text-purple-800";
      case 'responded': return base + "bg-green-100 text-green-800";
      default: return base + "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600 font-medium">Loading inbox...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <Toaster />
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>📩</span> Customer Messages
            </h1>
            <p className="text-gray-500 text-sm">Manage and respond to user queries</p>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            <StatCard label="Total" value={stats.total || 0} color="text-gray-700" />
            <StatCard label="New" value={stats.unread || 0} color="text-blue-600" />
            <StatCard label="Resolved" value={stats.resolved || 0} color="text-green-600" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
          <input
            type="text"
            placeholder="Search messages..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="bg-white border border-gray-200 px-4 py-2.5 rounded-xl text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="replied">Replied</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Messages Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {messages.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-500">No messages found matching your criteria.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm">
                      {msg.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 leading-none">{msg.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{msg.email}</p>
                    </div>
                  </div>
                  <span className={getStatusClass(msg.status)}>{msg.status}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
                      {msg.queryType}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-400">{formatDate(msg.createdAt)}</span>
                  </div>
                  <h4 className="font-bold text-gray-800 text-sm">Sub: {msg.subject}</h4>
                  <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
                    {msg.message}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between gap-4">
                <button
                  onClick={() => {
                    setSelectedMessage(msg);
                    setReplyText(msg.response || '');
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-5 rounded-lg transition-colors shadow-sm"
                >
                  View & Reply
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center gap-2 pb-10">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>

          <div className="flex items-center gap-1">
            {[...Array(totalPages)].map((_, index) => (
              <button
                key={index + 1}
                onClick={() => setCurrentPage(index + 1)}
                className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${currentPage === index + 1
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'
                  }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Reply to Request</h3>
              <button onClick={() => setSelectedMessage(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-indigo-50/50 p-4 rounded-xl">
                <p className="text-xs text-indigo-600 font-bold mb-1">USER MESSAGE:</p>
                <p className="text-sm text-gray-700 italic">"{selectedMessage.message}"</p>
              </div>
              <textarea
                className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[150px]"
                placeholder="Write your professional response here..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setSelectedMessage(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleReply}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-shadow shadow-lg shadow-indigo-200"
              >
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm min-w-[120px]">
      <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}