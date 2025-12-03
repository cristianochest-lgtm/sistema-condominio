import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc,
  doc,
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ClipboardList, 
  Building2, 
  Calendar, 
  Clock, 
  Truck, 
  CheckCircle2, 
  AlertCircle,
  Trash2
} from 'lucide-react';

// Código para gerar o ícone de edifício em Base64 (SVG) para o favicon
const buildingSvgBase64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzFkNGVkOCI+PHBhdGggZD0iTTEyIDJMMzA3djEwbDlNNzVMMTUgMjVMMTUgMjVNNy43OCA1LjU2VjcuNzhMMTMgMTUuMzNMMTcgMTMuMTF2LTQuNDRMMTIgMTEiLz48L3N2Zz4='; 

// --- Configuração do Firebase (Variáveis globais do ambiente) ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

export default function App() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    company: '',
    serviceDate: new Date().toISOString().split('T')[0],
    serviceTime: '',
    notes: ''
  });

  // 0. Configurações de Aparência e Favicon
  useEffect(() => {
    // 0.1 Definir Título da Página (Aba do Navegador)
    document.title = "Condomínio Gilles Deleuze";

    // 0.2 Forçar a substituição do Ícone da Aba (Favicon)
    const setFavicon = () => {
        // Remove qualquer ícone existente que possa estar sendo forçado pelo ambiente
        const existingIcons = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
        existingIcons.forEach(icon => icon.remove());

        // Cria o novo link de favicon usando o SVG Base64 gerado
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = buildingSvgBase64;
        document.head.appendChild(link);
    };
    setFavicon();

  }, []);

  // 1. Autenticação (Login Anônimo para acesso público)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // Se não houver token, faz login anônimo (acesso público)
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Leitura de Dados em Tempo Real
  useEffect(() => {
    if (!user) return;

    // O path 'public' é usado para dados compartilhados
    const ordersCollection = collection(db, 'artifacts', appId, 'public', 'data', 'service_orders');

    const unsubscribe = onSnapshot(ordersCollection, (snapshot) => {
      const loadedOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordena do mais novo para o mais antigo
      loadedOrders.sort((a, b) => {
        const dateA = new Date(`${a.serviceDate}T${a.serviceTime || '00:00'}`);
        const dateB = new Date(`${b.serviceDate}T${b.serviceTime || '00:00'}`);
        return dateB - dateA;
      });

      setOrders(loadedOrders);
      setLoading(false);
    }, (error) => {
      console.error("Data Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Manipular mudanças
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 3. Salvar (Create)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    try {
      const ordersCollection = collection(db, 'artifacts', appId, 'public', 'data', 'service_orders');
      
      await addDoc(ordersCollection, {
        company: formData.company,
        serviceDate: formData.serviceDate,
        serviceTime: formData.serviceTime,
        notes: formData.notes,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });

      setFormData({
        company: '',
        serviceDate: new Date().toISOString().split('T')[0],
        serviceTime: '',
        notes: ''
      });
      setSuccessMsg('Registro salvo com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);

    } catch (error) {
      console.error("Save Error:", error);
      // Aqui usamos window.alert() porque estamos fora do ambiente Canvas/Gemini.
      window.alert("Erro de conexão ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Excluir (Delete)
  const handleDelete = async (id) => {
    if (!window.confirm("Confirmar exclusão deste registro?")) return;

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'service_orders', id);
      await deleteDoc(docRef);
      setSuccessMsg('Registro removido.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error("Delete Error:", error);
      window.alert("Erro ao excluir.");
    }
  };

  if (!user && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-slate-500 gap-2 font-medium">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        Carregando Sistema...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-10">
      
      {/* Cabeçalho Profissional */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            
            {/* LOGOTIPO: Ícone de Prédio Simples e Profissional */}
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm flex-shrink-0">
              <Building2 size={24} />
            </div>
            {/* FIM DO LOGOTIPO */}

            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-none">Condomínio Gilles Deleuze</h1>
              <span className="text-xs text-slate-500 font-medium tracking-wide uppercase mt-1 block">Sistema de Portaria v1.0</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Online
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        
        {/* Formulário */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="text-blue-600" size={20} />
              <h2 className="font-semibold text-base text-slate-700">Novo Registro</h2>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Empresa / Prestador</label>
              <div className="relative">
                <Truck className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input
                  required
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Nome da empresa ou técnico..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input
                    required
                    type="date"
                    name="serviceDate"
                    value={formData.serviceDate}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horário</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input
                    required
                    type="time"
                    name="serviceTime"
                    value={formData.serviceTime}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Detalhes adicionais..."
                rows="2"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-2.5 rounded-lg font-medium text-white text-sm transition flex items-center justify-center gap-2 ${
                submitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {submitting ? 'Processando...' : 'Confirmar Registro'}
            </button>

            {successMsg && (
              <div className="bg-green-50 text-green-700 p-3 rounded-lg flex items-center gap-2 border border-green-200 text-sm animate-in fade-in">
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}
          </form>
        </section>

        {/* Lista */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              Histórico de Entradas
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
              Total: {orders.length}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Carregando dados...</div>
          ) : orders.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
              <ClipboardList className="mx-auto mb-2 text-slate-300" size={32} />
              <p className="text-sm">Nenhum registro encontrado.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {orders.map((order) => (
                <div key={order.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:border-blue-300 transition group relative">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-8">
                      <h4 className="font-semibold text-slate-800 text-base">{order.company}</h4>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                          <Calendar size={12} />
                          {new Date(order.serviceDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                        <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                          <Clock size={12} />
                          {order.serviceTime}
                        </span>
                      </div>
                      {order.notes && (
                        <p className="mt-2 text-slate-600 text-sm border-l-2 border-slate-200 pl-2">
                          {order.notes}
                        </p>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => handleDelete(order.id)}
                      className="text-slate-300 hover:text-red-500 transition p-1.5 rounded hover:bg-red-50 absolute top-3 right-3"
                      title="Remover"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}