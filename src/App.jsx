import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";

// ------------------------------
// 🔥 CONFIG FIREBASE (CORRETO)
// ------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ------------------------------
// 🔥 APP PRINCIPAL
// ------------------------------
export default function App() {
  const [condominos, setCondominos] = useState([]);
  const [nome, setNome] = useState("");
  const [bloco, setBloco] = useState("");
  const [apartamento, setApartamento] = useState("");

  // Carregar dados
  const loadData = async () => {
    const querySnapshot = await getDocs(collection(db, "condominos"));
    const lista = [];
    querySnapshot.forEach((docu) => {
      lista.push({ id: docu.id, ...docu.data() });
    });
    setCondominos(lista);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Adicionar
  const handleAdd = async () => {
    if (!nome || !bloco || !apartamento) {
      alert("Preencha todos os campos!");
      return;
    }

    await addDoc(collection(db, "condominos"), {
      nome,
      bloco,
      apartamento,
    });

    setNome("");
    setBloco("");
    setApartamento("");
    loadData();
  };

  // Excluir
  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "condominos", id));
    loadData();
  };

  // ------------------------------
  // 🎨 LAYOUT ORIGINAL DA IMAGEM
  // ------------------------------
  return (
    <div style={{
      padding: "30px",
      fontFamily: "Arial, sans-serif",
      maxWidth: "600px",
      margin: "0 auto"
    }}>
      
      <h1 style={{ textAlign: "center", marginBottom: 30 }}>
        Sistema de Condomínio
      </h1>

      <div style={{
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        marginBottom: "25px",
        background: "#fafafa"
      }}>
        <h2 style={{ marginTop: 0 }}>Adicionar Morador</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            style={{ padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
          />

          <input
            placeholder="Bloco"
            value={bloco}
            onChange={(e) => setBloco(e.target.value)}
            style={{ padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
          />

          <input
            placeholder="Apartamento"
            value={apartamento}
            onChange={(e) => setApartamento(e.target.value)}
            style={{ padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
          />

          <button
            onClick={handleAdd}
            style={{
              padding: "10px",
              borderRadius: "5px",
              border: "none",
              background: "#007bff",
              color: "white",
              fontSize: "16px",
              cursor: "pointer"
            }}
          >
            Adicionar
          </button>
        </div>
      </div>

      <h2>Lista de Moradores</h2>

      <ul style={{ padding: 0, listStyle: "none" }}>
        {condominos.map((item) => (
          <li key={item.id} style={{
            padding: "12px",
            border: "1px solid #ddd",
            borderRadius: "6px",
            marginBottom: "10px",
            background: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span>
              <strong>{item.nome}</strong> — Bloco {item.bloco} — Apt {item.apartamento}
            </span>

            <button
              onClick={() => handleDelete(item.id)}
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: "5px",
                background: "#dc3545",
                color: "white",
                cursor: "pointer"
              }}
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
