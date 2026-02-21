import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, RefreshCw, Mail, Phone, ArrowRight, Loader } from 'lucide-react';
import leadsService from '../services/leadsService';

export default function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await leadsService.getLeads();
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => (
      `${client.firstName || ''} ${client.lastName || ''}`.toLowerCase().includes(q)
      || (client.email || '').toLowerCase().includes(q)
      || (client.phone || '').toLowerCase().includes(q)
      || (client.productType || '').toLowerCase().includes(q)
    ));
  }, [clients, searchTerm]);

  const sortedClients = useMemo(() => (
    [...filteredClients].sort((a, b) => {
      const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })
  ), [filteredClients]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-400" />
            Clients
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            View and open client profiles, meetings, transcripts and AI history.
          </p>
        </div>
        <button
          onClick={fetchClients}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-gray-200 rounded-xl hover:bg-white/10 transition-all text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search clients by name, email, phone, product..."
          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 text-sm text-gray-400">
            {sortedClients.length} client(s)
          </div>

          {sortedClients.length === 0 ? (
            <div className="text-center py-14 text-gray-500 text-sm">
              No clients found.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {sortedClients.map((client) => {
                const name = `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unknown';
                return (
                  <div key={client.id} className="px-5 py-4 hover:bg-white/5 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{name}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-400">
                          {client.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" />
                              {client.email}
                            </span>
                          )}
                          {client.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {client.phone}
                            </span>
                          )}
                          <span>Product: {client.productType || 'N/A'}</span>
                          <span>Pipeline: {client.pipelineStatus || 'new'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/admin/clients/${client.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white text-sm"
                      >
                        Open Profile
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
