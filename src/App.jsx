import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";

// ------------------------------
// 🔥 CONFIG FIREBASE (CORRETO E CORRIGIDO)
// ------------------------------
// ATENÇÃO: Configuração dinâmica usando __firebase_config (ambiente Canvas).
// O fallback para VITE local deve ser feito com um objeto direto para evitar 
// o aviso de compilação de 'import.meta.env'.
let firebaseConfig;

// 1. Tenta usar a configuração injetada pelo ambiente (Canvas)
if (typeof __firebase_config !== 'undefined' && __firebase_config) {
  try {
    firebaseConfig = JSON.parse(__firebase_config);
  } catch (e) {
    console.error("Erro ao fazer parse de __firebase_config:", e);
    // Em caso de erro, prossegue para o fallback
  }
}

// 2. Fallback para VITE local (simulação de carregamento de ENV para evitar erro de compilação)
if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.warn("Aviso: Usando fallback de configuração. Se estiver no VITE, verifique suas variáveis .env. Usaremos chaves vazias para não quebrar a aplicação.");
  // Usamos um objeto vazio ou mockado. Se o usuário estiver no VITE, ele deve ter acesso
  // a um mecanismo de injeção que funcione sem 'import.meta.env' no código final.
  // Para este ambiente, removemos o import.meta.env problemático.
  firebaseConfig = {
    apiKey: "YOUR_VITE_API_KEY", // Placeholder - Deve ser preenchido externamente no ambiente VITE
    authDomain: "YOUR_VITE_AUTH_DOMAIN",
    projectId: "YOUR_VITE_PROJECT_ID",
    storageBucket: "YOUR_VITE_STORAGE_BUCKET",
    messagingSenderId: "YOUR_VITE_MESSAGING_SENDER_ID",
    appId: "YOUR_VITE_APP_ID",
    measurementId: "YOUR_VITE_MEASUREMENT_ID",
  };
}

// Verifica se a configuração foi carregada corretamente antes de inicializar o app
if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_")) {
    console.error("ERRO CRÍTICO: Configuração do Firebase parece ausente ou incompleta. As operações de banco de dados podem falhar.");
    // O aplicativo tentará continuar, mas as operações do Firebase falharão.
}


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ------------------------------
// 🛠️ FUNÇÕES DE UTILIDADE
// ------------------------------

// Retorna a data e hora atual em formato YYYY-MM-DD e HH:MM
const getInitialDateTime = () => {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].substring(0, 5);
    return { date, time };
};

const { date: initialDate, time: initialTime } = getInitialDateTime();

// Formata a data para exibição (DD/MM/YYYY às HH:MM)
const formatDateTime = (isoString) => {
    if (!isoString) return "Data Inválida";
    const date = new Date(isoString);
    if (isNaN(date)) return "Data Inválida";
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} às ${hour}:${minute}`;
};

// ------------------------------
// 🔥 APP PRINCIPAL
// ------------------------------
export default function App() {
  const [registros, setRegistros] = useState([]);
  const [empresa, setEmpresa] = useState("");
  const [data, setData] = useState(initialDate);
  const [horario, setHorario] = useState(initialTime);
  const [observacao, setObservacao] = useState("");
  const [message, setMessage] = useState(null);

  // Função para limpar a mensagem após um tempo
  const clearMessage = () => {
    setTimeout(() => setMessage(null), 4000);
  };

  // Carregar dados (Histórico de Entradas)
  const loadData = async () => {
    try {
        // Criamos uma query para ordenar por dataHora decrescente (mais recente primeiro)
        const registrosCollection = collection(db, "registros_portaria");
        
        // ATENÇÃO: Evitamos orderBy no Firestore para evitar erros de índice. 
        // Em vez disso, ordenamos os dados localmente.
        const querySnapshot = await getDocs(registrosCollection);
        
        const lista = [];
        querySnapshot.forEach((docu) => {
          lista.push({ id: docu.id, ...docu.data() });
        });
        
        // Ordenação local: mais recente primeiro
        lista.sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

        setRegistros(lista);
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        setMessage({ text: "Erro ao carregar histórico. Verifique o Firebase.", type: "error" });
        clearMessage();
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Adicionar (Confirmar Registro)
  const handleAdd = async () => {
    if (!empresa || !data || !horario) {
      setMessage({ text: "Empresa, Data e Horário são obrigatórios!", type: "error" }); 
      clearMessage();
      return;
    }

    try {
        // Combina data e horário para um único ISO string (Timestamp)
        const dataHoraRegistro = new Date(`${data}T${horario}:00`).toISOString();
        
        await addDoc(collection(db, "registros_portaria"), {
          empresa: empresa,
          dataHora: dataHoraRegistro,
          observacao: observacao || "Sem observação",
        });

        // Limpa os campos, mas mantém a data/hora atuais para facilitar novos registros
        setEmpresa("");
        setObservacao("");
        
        // Atualiza a lista e define uma nova data/hora inicial para o próximo registro
        const newInitial = getInitialDateTime();
        setData(newInitial.date);
        setHorario(newInitial.time);
        
        loadData();
        setMessage({ text: "Registro salvo com sucesso!", type: "success" });
        clearMessage();
    } catch (error) {
        console.error("Erro ao adicionar registro:", error);
        setMessage({ text: "Erro ao confirmar registro. Tente novamente.", type: "error" });
        clearMessage();
    }
  };

  // Excluir
  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este registro?")) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, "registros_portaria", id));
        loadData();
        setMessage({ text: "Registro excluído com sucesso!", type: "success" });
        clearMessage();
    } catch (error) {
        console.error("Erro ao excluir:", error);
        setMessage({ text: "Erro ao excluir registro. Tente novamente.", type: "error" });
        clearMessage();
    }
  };

  // ------------------------------
  // 🎨 LAYOUT IDÊNTICO À IMAGEM
  // ------------------------------
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      
      {/* Cabeçalho Condomínio Gilles Deleuze - Idêntico à imagem */}
      <header className="bg-blue-800 text-white shadow-xl mb-8">
        <div className="max-w-3xl mx-auto p-6 text-center">
            <h1 className="text-3xl font-bold">
              Condomínio Gilles Deleuze
            </h1>
            <p className="text-sm font-normal opacity-80 mt-1">
              Portaria - Sistema de Registro
            </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4">
        
        {/* Mensagens de feedback (similar ao box verde na imagem) */}
        {message && (
          <div className={`p-4 mb-6 rounded-lg font-medium text-center ${
            message.type === 'error' 
              ? 'bg-red-100 text-red-700 border border-red-300' 
              : 'bg-green-100 text-green-700 border border-green-300'
          }`}>
            {message.text}
          </div>
        )}

        {/* Formulário de Novo Registro - Idêntico à imagem */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">
            Novo Registro
          </h2>

          <div className="space-y-4">
            {/* Campo Empresa / Prestador */}
            <label className="block text-gray-700 font-medium">Empresa / Prestador</label>
            <input
              type="text"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150"
            />
            
            {/* Campo Data e Horário (lado a lado) */}
            <div className="flex space-x-4">
              <div className="w-1/2">
                <label className="block text-gray-700 font-medium">Data</label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                />
              </div>
              <div className="w-1/2">
                <label className="block text-gray-700 font-medium">Horário</label>
                <input
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                />
              </div>
            </div>

            {/* Campo Observação */}
            <label className="block text-gray-700 font-medium">Observação</label>
            <textarea
              placeholder="Detalhes adicionais ou notas..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows="3"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 resize-none"
            ></textarea>

            {/* Botão Confirmar Registro */}
            <button
              onClick={handleAdd}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-md hover:bg-blue-700 transition duration-200 shadow-md mt-4"
            >
              Confirmar Registro
            </button>
          </div>
        </div>

        {/* Histórico de Entradas - Idêntico à imagem */}
        <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
          HISTÓRICO DE ENTRADAS
        </h2>
        
        {/* Total de Registros (simulando o "Total 0" da imagem) */}
        <p className="text-right text-sm text-gray-500 mb-4">Total: {registros.length}</p>

        <ul className="space-y-3">
          {registros.length === 0 ? (
            <li className="p-4 bg-white border border-gray-200 rounded-lg text-center text-gray-500 shadow-sm">
              Nenhum registro encontrado.
            </li>
          ) : (
            registros.map((item) => (
              <li 
                key={item.id} 
                className="flex justify-between items-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
              >
                <div className="text-gray-700 flex-grow pr-4">
                  <span className="font-bold text-lg text-blue-700 block">
                    {item.empresa}
                  </span>
                  <span className="text-sm text-gray-600 mt-1 block">
                    {formatDateTime(item.dataHora)}
                  </span>
                  <span className={`text-xs mt-1 block ${item.observacao === "Sem observação" ? 'text-gray-400 italic' : 'text-gray-500'}`}>
                    {item.observacao}
                  </span>
                </div>

                {/* Ícone de Lixo (Deletar) */}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-gray-400 hover:text-red-600 transition duration-200 p-2 rounded-full"
                  title="Excluir Registro"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 10-2 0v6a1 1 0 102 0V8z" clipRule="evenodd" />
                  </svg>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}