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
  Trash2,
  X // Ícone de fechar para notificação
} from 'lucide-react';

// Código para gerar o ícone de edifício em Base64 (SVG) para o favicon
const buildingSvgBase64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzFkNGVkOCI+PHBhdGggZD0iTTEyIDJMMzA3djEwbDlNNzVMMTUgMjVMMTUgMjVNNy43OCA1LjU2VjcuNzhMMTMgMTUuMzNMMTcgMTMuMTF2LTQuNDRMMTIgMTEiLz48L3N2Zz4='; 

// --- Configuração do Firebase (Adaptado para usar variáveis globais do ambiente) ---
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Componente de Modal de Confirmação (Substitui window.confirm)
const ConfirmModal = ({ visible, message, onConfirm, onCancel }) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <AlertCircle className="text-red-500" size={20} />
          Confirmação
        </h3>
        <p className="text-sm text-slate-600">{message}</p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
          >
            Confirmar Exclusão
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------
    COMponente App
-------------------------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Substitui successMsg por um estado de notificação completo (para sucesso/erro)
  const [notification, setNotification] = useState({ message: '', type: '', visible: false });
  
  // Estado para o modal de confirmação de exclusão
  const [confirmDialog, setConfirmDialog] = useState({
    visible: false,
    message: '',
    actionId: null,
    onConfirm: () => {}
  });

  const [formData, setFormData] = useState({
    company: '',
    serviceDate: new Date().toISOString().split('T')[0],
    serviceTime: '',
    notes: ''
  });

  // Função para mostrar notificações (Substitui window.alert)
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type, visible: true });
    setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 4000);
  };

  // 0. Configurações de Aparência e Favicon
  useEffect(() => {
    document.title = "Condomínio Gilles Deleuze";

    const setFavicon = () => {
      const existingIcons = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
      existingIcons.forEach(icon => icon.remove());

      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      link.href = buildingSvgBase64;
      document.head.appendChild(link);
    };
    setFavicon();
  }, []);

  // 1. Autenticação (usa token customizado se houver, senão anônimo)
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Usa a variável global __initial_auth_token
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Leitura de Dados em Tempo Real
  useEffect(() => {
    if (!user) return;

    const ordersCollection = collection(db, 'artifacts', appId, 'public', 'data', 'service_orders');

    const unsubscribe = onSnapshot(ordersCollection, (snapshot) => {
      const loadedOrders = snapshot.docs.map(docItem => ({
        id: docItem.id,
        ...docItem.data()
      }));

      // Ordena do mais novo para o mais antigo
      loadedOrders.sort((a, b) => {
        const timeA = a.createdAt?.seconds || Date.parse(`${a.serviceDate}T${a.serviceTime || '00:00'}`);
        const timeB = b.createdAt?.seconds || Date.parse(`${b.serviceDate}T${b.serviceTime || '00:00'}`);
        return timeB - timeA;
      });

      setOrders(loadedOrders);
      setLoading(false);
    }, (error) => {
      console.error("Data Error:", error);
      setLoading(false);
      showNotification("Erro ao carregar dados: " + error.message, 'error');
    });

    return () => unsubscribe();
  }, [user]);

  // Manipular mudanças no formulário
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
      showNotification('Registro salvo com sucesso!', 'success'); // Usa notificação customizada

    } catch (error) {
      console.error("Save Error:", error);
      showNotification("Erro de conexão ao salvar: " + error.message, 'error'); // Usa notificação customizada
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Excluir (Delete) - Etapa 1: Abrir Modal (Substitui window.confirm)
  const initiateDelete = (id) => {
    setConfirmDialog({
      visible: true,
      message: `Tem certeza que deseja excluir o registro? Esta ação é irreversível.`,
      actionId: id,
      onConfirm: () => {
        executeDelete(id);
        setConfirmDialog({ visible: false, message: '', actionId: null, onConfirm: () => {} });
      }
    });
  };

  // 4. Excluir (Delete) - Etapa 2: Executar Exclusão
  const executeDelete = async (id) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'service_orders', id);
      await deleteDoc(docRef);
      showNotification('Registro removido.', 'success');
    } catch (error) {
      console.error("Delete Error:", error);
      showNotification("Erro ao excluir: " + error.message, 'error');
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

  // Estilos da Notificação
  const notificationClasses = notification.type === 'success' 
    ? "bg-green-50 text-green-700 border-green-200" 
    : "bg-red-50 text-red-700 border-red-200";

  const notificationIcon = notification.type === 'success' 
    ? <CheckCircle2 size={16} /> 
    : <AlertCircle size={16} />;


  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-10">
      
      {/* Modal de Confirmação */}
      <ConfirmModal
        visible={confirmDialog.visible}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ visible: false, message: '', actionId: null, onConfirm: () => {} })}
      />
      
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

            {/* Notificação no Formulário */}
            {notification.visible && (
              <div 
                className={`p-3 rounded-lg flex items-center justify-between border text-sm animate-in fade-in ${notificationClasses}`}
              >
                <div className="flex items-center gap-2">
                    {notificationIcon}
                    <span>{notification.message}</span>
                </div>
                <button onClick={() => setNotification(prev => ({ ...prev, visible: false }))} className="p-1 text-inherit hover:opacity-80">
                    <X size={16} />
                </button>
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
                      onClick={() => initiateDelete(order.id)}
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
