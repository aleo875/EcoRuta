import React, { useState, useEffect } from 'react';
import {
  Leaf, Map as MapIcon, Recycle, Trophy, Users, Settings,
  Mail, Lock, Eye, LogOut, Search, Bell, MapPin, CheckCircle,
  TrendingUp, Award, Globe
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, getDocs, addDoc, serverTimestamp, arrayUnion, query, orderBy, limit } from 'firebase/firestore';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";


// ============================================================================
// 1. CONFIGURACIÓN DE FIREBASE (Reglas de entorno estricto)
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCfpbW9vQHRUD0e-oB7IanSrKH88uaPWRg",
  authDomain: "ecorutabd.firebaseapp.com",
  projectId: "ecorutabd",
  storageBucket: "ecorutabd.firebasestorage.app",
  messagingSenderId: "605031175505",
  appId: "1:605031175505:web:20a9d11aa3b0d079326f70",
  measurementId: "G-XG4B0JCNSD"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ecoruta-app-id';

// ============================================================================
// 2. COMPONENTE PRINCIPAL
// ============================================================================
export default function EcoRutaApp() {
  // Estados de la aplicación
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('login'); // 'login', 'dashboard', 'achievements'
  const [userData, setUserData] = useState({
    puntosEco: 0,
    nivel: "Novato",
    medallas: []
  });
  const [nearbyPoints, setNearbyPoints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [puntoSeleccionado, setPuntoSeleccionado] = useState(null);
  const [ubicacionUsuario, setUbicacionUsuario] = useState(null);
  const [menuPerfilAbierto, setMenuPerfilAbierto] = useState(false);
  const [usuarioActivo, setUsuarioActivo] = useState(null);
  const [vistaActual, setVistaActual] = useState('inicio');
  const [materialSeleccionado, setMaterialSeleccionado] = useState('');
  const [kilos, setKilos] = useState('');
  const latFallback = 20.659698;
  const lngFallback = -103.349609;
  const [datosFirebase, setDatosFirebase] = useState(null);
  const [rankingComunidad, setRankingComunidad] = useState([]);
  const [menuNotificaciones, setMenuNotificaciones] = useState(false);
  const [esRegistro, setEsRegistro] = useState(false);
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');

  // 2. Función para manejar el inicio de sesión o registro
  const manejarAcceso = async (e) => {
    e.preventDefault();

    if (!correo || !password) {
      alert("Por favor, llena todos los campos.");
      return;
    }

    try {
      if (esRegistro) {
        // Registro de nuevo usuario
        const credenciales = await createUserWithEmailAndPassword(auth, correo, password);
        await setDoc(doc(db, "usuarios", credenciales.user.uid), {
          email: correo,
          nombre: correo.split('@')[0],
          puntos: 0,
          nivel: "Principiante",
          historial: []
        });
        alert("¡Cuenta creada con éxito!");
        // Aquí puedes redirigir al dashboard
        // setCurrentView('home'); 
      } else {
        // Iniciar sesión
        await signInWithEmailAndPassword(auth, correo, password);
        // Aquí puedes redirigir al dashboard
        // setCurrentView('home');
      }
    } catch (error) {
      console.error("Error de autenticación:", error);
      alert("Hubo un error: " + error.message);
    }
  };

  const recuperarPassword = async () => {
    // Abrimos una ventana emergente nativa pidiendo el correo. 
    // Le pasamos el estado 'correo' por si el usuario ya lo había empezado a escribir.
    const emailRecuperacion = window.prompt(
      "Ingresa tu correo electrónico para enviarte un enlace de recuperación:",
      correo
    );

    // Si el usuario cancela o lo deja en blanco, detenemos la función
    if (!emailRecuperacion) return;

    try {
      await sendPasswordResetEmail(auth, emailRecuperacion);
      alert("¡Listo! Te hemos enviado un enlace al correo para que restablezcas tu contraseña. (Revisa tu bandeja de Spam por si acaso).");
    } catch (error) {
      console.error("Error al enviar correo de recuperación:", error);
      alert("Hubo un problema al intentar enviar el correo. Verifica que esté bien escrito y que tengas conexión.");
    }
  };

  // Escuchar a toda la colección de usuarios para el ranking (Top 10)
  useEffect(() => {
    const q = query(collection(db, "usuarios"), orderBy("puntos", "desc"), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listaUsuarios = [];
      snapshot.forEach((documento) => {
        listaUsuarios.push(documento.data());
      });
      setRankingComunidad(listaUsuarios);
    });
    return () => unsubscribe();
  }, []);

  // Este useEffect escucha la base de datos automáticamente
  useEffect(() => {
    if (usuarioActivo) {
      const unsubscribe = onSnapshot(doc(db, "usuarios", usuarioActivo.uid), (documento) => {
        if (documento.exists()) {
          setDatosFirebase(documento.data());
        }
      });
      return () => unsubscribe();
    }
  }, [usuarioActivo]);

  const procesarReciclaje = async () => {
    if (!materialSeleccionado || !kilos) {
      alert("Por favor selecciona un material y la cantidad en kilos.");
      return;
    }

    // Verificamos que haya alguien con sesión iniciada
    if (!usuarioActivo) {
      alert("Por favor, inicia sesión en la esquina superior derecha para guardar tus puntos.");
      return;
    }

    // 10 puntos por cada kilo reciclado
    const puntosGanados = parseFloat(kilos) * 10;

    try {
      // Apuntamos al documento del usuario actual en la colección "usuarios"
      const usuarioRef = doc(db, "usuarios", usuarioActivo.uid);
      const docSnap = await getDoc(usuarioRef);

      let puntosActuales = 0;
      if (docSnap.exists() && docSnap.data().puntos) {
        puntosActuales = docSnap.data().puntos;
      }

      const totalPuntos = puntosActuales + puntosGanados;

      // Sistema básico de niveles
      let nuevoNivel = "Principiante";
      if (totalPuntos >= 100) nuevoNivel = "Reciclador Activo";
      if (totalPuntos >= 500) nuevoNivel = "Eco Guerrero";
      if (totalPuntos >= 1000) nuevoNivel = "Héroe del Planeta";

      // Guardamos los datos y agregamos el nuevo registro al historial
      await setDoc(usuarioRef, {
        puntos: totalPuntos,
        nivel: nuevoNivel,
        nombre: usuarioActivo.displayName,
        email: usuarioActivo.email,
        ultimoReciclaje: new Date().toISOString(),
        historial: arrayUnion({
          material: materialSeleccionado,
          kilos: kilos,
          puntos: puntosGanados,
          fecha: new Date().toISOString()
        })
      }, { merge: true });

      alert(`¡Éxito! Sumaste ${puntosGanados} Puntos Eco por reciclar ${materialSeleccionado}.`);

      // Limpiamos el formulario
      setMaterialSeleccionado('');
      setKilos('');

    } catch (error) {
      console.error("Error al guardar en Firebase:", error);
      alert("Hubo un problema al guardar tus puntos. Revisa la consola.");
    }
  };

  useEffect(() => {
    // onAuthStateChanged vigila si alguien entra o sale de la cuenta
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUsuarioActivo(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const iniciarSesion = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error al iniciar sesión: ", error);
    }
  };

  const registrarReciclaje = async () => {
    const nuevosPuntos = userData.puntosEco + 50;
    let nuevoNivel = userData.nivel;
    const nuevasMedallas = [...userData.medallas];

    if (nuevosPuntos >= 100 && userData.nivel === "Novato") {
      nuevoNivel = "Reciclador Activo";
      nuevasMedallas.push("Primera Meta: 100 pts");
    } else if (nuevosPuntos >= 300 && userData.nivel === "Reciclador Activo") {
      nuevoNivel = "Héroe Verde";
      nuevasMedallas.push("Medalla Oro: 300 pts");
    }

    const nuevosDatos = {
      puntosEco: nuevosPuntos,
      nivel: nuevoNivel,
      medallas: nuevasMedallas
    };

    try {
      // Guardamos en Firebase usando el mismo ID
      const userRef = doc(db, "users", "mi-usuario-demo");
      await setDoc(userRef, nuevosDatos, { merge: true });

      // Actualizamos el estado en React para que se refleje en las tarjetas
      setUserData(nuevosDatos);
      alert(`¡Felicidades! Guardaste tu progreso en ${puntoSeleccionado.nombre} 🌱`);
      setPuntoSeleccionado(null);
    } catch (error) {
      console.error("Error al guardar en Firebase:", error);
      alert("Hubo un error al guardar tu progreso.");
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUbicacionUsuario({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("El usuario no dio permiso o hubo un error:", error);
        }
      );
    }
  }, []);

  useEffect(() => {
    const cargarDatosUsuario = async () => {
      // Apuntamos al documento "mi-usuario-demo" en la colección "users"
      const userRef = doc(db, "users", "mi-usuario-demo");
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setUserData(userSnap.data());
      }
    };

    cargarDatosUsuario();
  }, []);

  // 1. La función va aquí, libre para que el botón la encuentre
  const loginConGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // Estas dos líneas le dicen a React que quite el login y muestre el mapa
      setCurrentView('dashboard');
      setIsLoading(false);
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
    }
  };

  // 2. El useEffect queda limpio, solo revisando la sesión activa
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // 1. Buscamos al usuario en la colección 'users'
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          // 2. Si no existe, creamos su perfil con 0 puntos
          const nuevoPerfil = {
            nombre: currentUser.displayName,
            correo: currentUser.email,
            puntosEco: 0,
            nivel: "Novato Reciclador",
            medallas: [],
            fechaRegistro: serverTimestamp()
          };
          await setDoc(userRef, nuevoPerfil);
          setUserData(nuevoPerfil);
        } else {
          // 3. Si ya existe, descargamos sus datos guardados
          setUserData(userSnap.data());
        }

        // 4. Cambiamos la vista al mapa automáticamente
        setCurrentView('dashboard');
        setIsLoading(false);
      } else {
        // Si cierra sesión, lo devolvemos al login
        setCurrentView('login');
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Escuchamos la colección de puntos de reciclaje en tiempo real
    const unsubscribe = onSnapshot(collection(db, "puntos_reciclaje"), (snapshot) => {
      const puntos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNearbyPoints(puntos);
    });

    return () => unsubscribe();
  }, []);
  // --- Obtención de Datos de Firestore (Reglas 1 y 2) ---
  useEffect(() => {
    if (!user) return;

    // Referencias a las rutas estructuradas
    const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'stats');
    const publicPointsRef = collection(db, 'artifacts', appId, 'public', 'data', 'puntos_reciclaje');

    const fetchOrInitializeUserData = async () => {
      try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        } else {
          // Si el usuario es nuevo, creamos sus datos base (basado en tu mockup de logros)
          const newUserData = {
            nombre: "Alexei Fonseca (Nuevo)",
            puntosEco: 1500,
            nivel: "Nivel 3 - Ecoguerrero",
            co2Ahorrado: 50,
            arbolesEquivalentes: 2,
            insignias: [
              { id: 1, nombre: "Reciclador Inicial", icono: "Recycle", activa: true },
              { id: 2, nombre: "Eco-Héroe", icono: "Award", activa: true },
              { id: 3, nombre: "Guardián del Planeta", icono: "Globe", activa: false }
            ]
          };
          await setDoc(userDocRef, newUserData);
          setUserData(newUserData);
        }
      } catch (error) {
        console.error("Error obteniendo datos de usuario:", error);
      }
    };

    const fetchPublicPoints = async () => {
      try {
        const querySnapshot = await getDocs(publicPointsRef);
        if (querySnapshot.empty) {
          // Poblar datos de prueba si la colección está vacía para que el mapa no se vea en blanco
          const dummyPoints = [
            { id: '1', nombre: "Centro de Reciclaje Av. Reforma", tipo: "Centro de acopio", estado: "Abierto", distancia: "1.2 km" },
            { id: '2', nombre: "Contenedores Parque Central", tipo: "Contenedor", estado: "Abierto", distancia: "3.5 km" },
            { id: '3', nombre: "Taller Comunitario Zona Sur", tipo: "Talleres / Eventos", estado: "Cerrado", distancia: "5.0 km" }
          ];
          dummyPoints.forEach(async (point) => {
            await addDoc(publicPointsRef, point);
          });
          setNearbyPoints(dummyPoints);
        } else {
          const points = [];
          querySnapshot.forEach((doc) => points.push({ id: doc.id, ...doc.data() }));
          setNearbyPoints(points);
        }
      } catch (error) {
        console.error("Error obteniendo puntos:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrInitializeUserData();
    fetchPublicPoints();

    // Escuchar cambios en tiempo real de los datos del usuario
    const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) setUserData(doc.data());
    }, (error) => console.error(error));

    return () => unsubscribeUser();
  }, [user]);

  // Manejador del Login simulado
  const handleLogin = (e) => {
    e.preventDefault();
    setCurrentView('dashboard');
  };



  const handleLogout = () => {
    setCurrentView('login');
  };

  // ============================================================================
  // COMPONENTES DE INTERFAZ (UI)
  // ============================================================================

  // --- Vista 1: Pantalla de Login ---
  if (currentView === 'login') {
    return (
      <div className="min-h-screen flex w-full bg-slate-50 font-sans">
        {/* Lado Izquierdo - Branding (Imagen/Gradiente) */}
        <div className="hidden lg:flex flex-col justify-center w-1/2 bg-gradient-to-br from-green-800 to-green-600 text-white p-16 relative overflow-hidden">
          {/* Elementos decorativos de fondo simulando naturaleza */}
          <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.2) 0%, transparent 50%)' }}></div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-12">
              <Leaf className="w-10 h-10 text-green-300" />
              <h1 className="text-3xl font-bold tracking-tight">EcoRuta</h1>
            </div>

            <h2 className="text-5xl font-extrabold mb-6 leading-tight">
              Pequeñas <br />acciones,<br />grandes cambios
            </h2>
            <p className="text-lg text-green-100 mb-12 max-w-md">
              Únete a la comunidad que hace la diferencia. Recicla, reduce, reutiliza.
            </p>

            <div className="flex gap-8 text-sm font-medium text-green-200">
              <div className="flex items-center gap-2"><Globe className="w-5 h-5" /> Un planeta más limpio</div>
              <div className="flex items-center gap-2"><Users className="w-5 h-5" /> Comunidades más fuertes</div>
            </div>
          </div>
        </div>

        {/* Lado Derecho - Formulario */}
        <div className="flex w-full lg:w-1/2 items-center justify-center p-8 bg-white">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-8 text-green-700">
              <Leaf className="w-8 h-8" />
              <h1 className="text-2xl font-bold">EcoRuta</h1>
            </div>

            {/* Títulos dinámicos */}
            <h2 className="text-3xl font-bold text-slate-800 mb-2">
              {esRegistro ? 'Crea tu cuenta en EcoRuta' : '¡Bienvenido a EcoRuta!'}
            </h2>
            <p className="text-slate-500 mb-8">
              {esRegistro
                ? 'Únete a nuestra comunidad hoy mismo.'
                : 'Inicia sesión para continuar con tu ruta hacia un planeta más sostenible.'}
            </p>

            {/* Formulario actualizado con la nueva función */}
            <form onSubmit={manejarAcceso} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  {/* Input dinámico de correo */}
                  <input
                    type="email"
                    required
                    placeholder="tu@email.com"
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  {/* Input dinámico de contraseña */}
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-400 hover:text-slate-600">
                    <Eye className="h-5 w-5" />
                  </div>
                </div>
              </div>

              {/* Ocultamos "Recordar sesión" si estamos en modo registro */}
              {!esRegistro && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                    <input type="checkbox" className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500" defaultChecked />
                    <span>Recordar sesión</span>
                  </label>
                  <button
                    type="button"
                    onClick={recuperarPassword}
                    className="text-sm font-medium text-green-600 hover:text-green-700"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              {/* Botón principal dinámico */}
              <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98]">
                {esRegistro ? 'Registrarme' : 'Iniciar sesión'}
              </button>
            </form>

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-slate-500">o continúa con</span></div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <button type="button" onClick={loginConGoogle} className="flex items-center justify-center gap-2 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium text-slate-700">
                  <span className="text-red-500 font-bold text-lg">G</span> Google
                </button>
                <button type="button" className="flex items-center justify-center gap-2 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium text-slate-700">
                  <span className="text-blue-500 font-bold text-lg">M</span> Microsoft
                </button>
              </div>
            </div>

            {/* Texto inferior interactivo para cambiar de modo */}
            <p className="mt-8 text-center text-sm text-slate-600">
              {esRegistro ? '¿Ya tienes una cuenta? ' : '¿No tienes una cuenta? '}
              <button
                type="button"
                onClick={() => setEsRegistro(!esRegistro)}
                className="font-bold text-green-600 hover:underline"
              >
                {esRegistro ? 'Inicia sesión' : 'Regístrate'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Layout Principal (Sidebar + Topbar) ---
  return (
    <div className="h-screen flex bg-slate-100 font-sans overflow-hidden">

      {/* Sidebar Navigation */}
      <div className="w-64 bg-[#112a22] text-slate-300 flex flex-col shadow-xl z-20">
        <div className="p-6 flex items-center gap-3 text-white mb-4">
          <Leaf className="w-8 h-8 text-green-400" />
          <h1 className="text-2xl font-bold tracking-wide">EcoRuta</h1>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavItem icon={<MapIcon />} label="Inicio / Mapa" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <NavItem icon={<Recycle />} label="Reciclaje" active={currentView === 'recycling'} onClick={() => setCurrentView('recycling')} />
          <NavItem icon={<MapPin />} label="Mis puntos" active={currentView === 'points'} onClick={() => setCurrentView('points')} />
          <NavItem icon={<Trophy />} label="Logros" active={currentView === 'achievements'} onClick={() => setCurrentView('achievements')} />
          <NavItem icon={<Users />} label="Comunidad" active={currentView === 'community'} onClick={() => setCurrentView('community')} />
          <NavItem icon={<Settings />} label="Configuración" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
        </nav>

        <div className="p-4 border-t border-slate-700/50 mt-auto">
          <div className="flex items-center gap-3 px-3 py-2 text-green-400 bg-green-900/30 rounded-lg mb-4 cursor-pointer hover:bg-green-900/50 transition-colors">
            <Leaf className="w-5 h-5" />
            <span className="font-medium text-sm">Juntos por un planeta mejor</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 w-full hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <LogOut className="w-5 h-5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">

        {/* Topbar */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-8 z-10 shrink-0">
          <div className="flex-1 max-w-md relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar puntos de reciclaje, lugares, etc."
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-green-500 transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  alert(`Buscando: ${e.target.value}... (Esta función se conectará a la API de mapas próximamente)`);
                }
              }}
            />
          </div>

          <div className="flex items-center gap-6 ml-4">
            <button className="relative text-slate-500 hover:text-slate-700 transition-colors">
              {/* Contenedor de Notificaciones */}
              <div className="relative">
                <button
                  onClick={() => setMenuNotificaciones(!menuNotificaciones)}
                  className="relative text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <Bell className="w-6 h-6" />
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                {/* Menú de Notificaciones */}
                {menuNotificaciones && (
                  <div className="absolute right-0 mt-4 w-72 bg-white rounded-xl shadow-lg border border-slate-100 p-4 z-50">
                    <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2 mb-2">
                      Notificaciones (2)
                    </h4>
                    <div className="flex flex-col gap-3">
                      <div className="text-sm">
                        <p className="font-semibold text-green-600">¡Nuevo nivel alcanzado!</p>
                        <p className="text-slate-500 text-xs">Eres un Reciclador Activo.</p>
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold text-blue-600">Punto de reciclaje cerca</p>
                        <p className="text-slate-500 text-xs">Añadieron un contenedor a 2km.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="relative">
              {/* Botón del perfil */}
              <div
                className="flex items-center gap-3 border-l border-slate-200 pl-6 cursor-pointer"
                onClick={() => setMenuPerfilAbierto(!menuPerfilAbierto)}
              >
                <img
                  src={usuarioActivo?.photoURL || "https://via.placeholder.com/150"}
                  alt="Perfil"
                  className="w-9 h-9 rounded-full object-cover border border-green-500 shadow-sm"
                />
                <span className="font-medium text-sm text-slate-700 hidden sm:block">
                  {usuarioActivo?.displayName || 'Usuario'}
                </span>
              </div>

              {/* Menú desplegable flotante */}
              {menuPerfilAbierto && (
                <div className="absolute right-0 mt-4 w-64 bg-white rounded-xl shadow-lg border border-slate-100 p-4 z-50 transition-all">
                  <div className="flex flex-col items-center border-b border-slate-100 pb-4 mb-3">
                    <img
                      src={usuarioActivo?.photoURL || "https://via.placeholder.com/150"}
                      alt="Perfil Grande"
                      className="w-16 h-16 rounded-full object-cover border-2 border-green-500 shadow-sm mb-3"
                    />
                    <p className="font-bold text-slate-800 text-sm text-center">
                      {usuarioActivo?.displayName || 'Usuario EcoRuta'}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">
                      {usuarioActivo?.email || 'correo@ejemplo.com'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => {
                        setCurrentView('settings');
                        setMenuPerfilAbierto(false);
                      }}
                      className="flex items-center gap-2 w-full text-left text-sm text-slate-600 hover:text-green-600 hover:bg-green-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Configuración de cuenta
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-8">

          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
          ) : (
            <>
              {/* --- Vista 2: Dashboard / Mapa --- */}
              {currentView === 'dashboard' && (
                <div className="max-w-5xl mx-auto space-y-6">
                  <div className="flex justify-between items-end mb-8">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-800">¡Hola, {userData?.nombre?.split(' ')[0] || 'Usuario'}!</h2>
                      <p className="text-slate-500 mt-1">Tu compromiso con el planeta hace la diferencia.</p>
                    </div>
                    <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-sm border border-green-200">
                      <Leaf className="w-4 h-4" />
                      +2.5 kg hoy
                    </div>
                  </div>

                  {/* Tarjeta del Mapa Simulada */}
                  <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-800">Puntos de reciclaje cercanos</h3>
                      <button className="text-sm text-green-600 font-medium hover:underline">Ver todos</button>
                    </div>

                    {/* Contenedor del Mapa Real de Google */}
                    <div className="relative w-full h-80 rounded-b-lg overflow-hidden group">
                      <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
                        <Map
                          defaultCenter={{ lat: 20.6500, lng: -103.3000 }}
                          defaultZoom={12}
                          mapId="MAPA_ECORUTA_ID"
                        >
                          {/* Marcador del usuario (Punto azul animado) */}
                          {ubicacionUsuario && (
                            <AdvancedMarker position={ubicacionUsuario} title="Tú estás aquí">
                              <div className="w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-md animate-pulse" />
                            </AdvancedMarker>
                          )}
                          {nearbyPoints.map((punto, index) => {
                            return (
                              <AdvancedMarker
                                key={punto.id}
                                position={{ lat: punto.lat || latFallback, lng: punto.lng || lngFallback }}
                                title={punto.nombre}
                                onClick={() => setPuntoSeleccionado(punto)}
                              >
                                <Pin
                                  background={punto.tipo === "Centro de acopio" ? '#22c55e' : '#3b82f6'}
                                  borderColor={'#ffffff'}
                                  glyphColor={'#ffffff'}
                                />
                              </AdvancedMarker>
                            );
                          })}
                          {/* Componente invisible que dibuja la ruta */}
                          <TrazadorDeRutas
                            origen={ubicacionUsuario}
                            destino={puntoSeleccionado ? { lat: puntoSeleccionado.lat, lng: puntoSeleccionado.lng } : null}
                          />
                        </Map>
                      </APIProvider>

                      {/* Tarjeta superpuesta de información dinámica */}
                      {puntoSeleccionado && (
                        <div className="absolute bottom-6 right-6 bg-white p-4 rounded-xl shadow-lg border border-slate-100 w-64 animate-fade-in transition-all z-10">
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="font-bold text-slate-800 text-sm leading-tight pr-2">
                              {puntoSeleccionado.nombre}
                            </h4>
                            <button
                              onClick={() => setPuntoSeleccionado(null)}
                              className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                            >
                              ✕
                            </button>
                          </div>
                          <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                            {puntoSeleccionado.tipo || "Punto Verde"}
                          </span>
                          <p className="text-slate-500 text-xs flex items-center gap-1 mt-3">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {puntoSeleccionado.dirección || "Ubicación en el mapa"}
                          </p>

                          {/* NUEVO BOTÓN DE GAMIFICACIÓN */}
                          <button
                            onClick={registrarReciclaje}
                            className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
                          >
                            <Recycle className="w-4 h-4" />
                            Registrar Reciclaje
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard icon={<Recycle className="w-6 h-6 text-green-600" />} value={`${userData?.puntosEco || 0} pts`} label="Puntos Eco" />
                    <StatCard icon={<Leaf className="w-6 h-6 text-green-600" />} value={userData?.nivel || "Novato"} label="Nivel actual" />
                    <StatCard icon={<Users className="w-6 h-6 text-green-600" />} value={userData?.medallas?.length || 0} label="Medallas ganadas" />
                  </div>
                </div>
              )}

              {/* VISTA 2: RECICLAJE */}
              {currentView === 'recycling' && (
                <div className="max-w-3xl mx-auto mt-8">
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-800">Registrar Reciclaje</h2>
                    <p className="text-slate-500 mt-2">¿Qué acciones verdes tomaste hoy? Regístralas para ganar Puntos Eco.</p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    <h3 className="font-semibold text-slate-700 mb-4">1. Selecciona el material</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      {['Plástico 🧴', 'Cartón 📦', 'Vidrio 🍾', 'Metal 🥫'].map((item) => {
                        const nombre = item.split(' ')[0];
                        const emoji = item.split(' ')[1];
                        return (
                          <button
                            key={nombre}
                            onClick={() => setMaterialSeleccionado(nombre)}
                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${materialSeleccionado === nombre
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-slate-100 hover:border-green-200 hover:bg-slate-50 text-slate-600'
                              }`}
                          >
                            <span className="text-3xl">{emoji}</span>
                            <span className="font-medium text-sm">{nombre}</span>
                          </button>
                        )
                      })}
                    </div>

                    <h3 className="font-semibold text-slate-700 mb-4">2. Cantidad aproximada (Kg)</h3>
                    <div className="flex items-center gap-4 mb-8">
                      <input
                        type="number"
                        placeholder="Ej. 1.5"
                        value={kilos}
                        onChange={(e) => setKilos(e.target.value)}
                        className="w-full md:w-1/3 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>

                    <button
                      onClick={procesarReciclaje}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      <Recycle className="w-6 h-6" />
                      Registrar y ganar puntos
                    </button>
                  </div>
                </div>
              )}

              {/* VISTA 3: MIS PUNTOS */}
              {currentView === 'points' && (
                <div className="max-w-4xl mx-auto mt-8">
                  <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-800">Historial de Puntos</h2>
                      <p className="text-slate-500 mt-2">El registro de todas tus acciones sostenibles.</p>
                    </div>

                    {/* Tarjeta de Total (Conectada a Firebase) */}
                    <div className="bg-green-50 border border-green-200 text-green-800 px-6 py-4 rounded-2xl flex flex-col items-center shadow-sm">
                      <span className="text-sm font-medium uppercase tracking-wider mb-1">Total Acumulado</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black">{datosFirebase?.puntos || 0}</span>
                        <span className="text-lg font-bold">pts</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50">
                      <h3 className="font-semibold text-slate-700">Actividad Reciente</h3>
                    </div>

                    <div className="divide-y divide-slate-100">

                      {/* Mapeo del historial real desde Firebase */}
                      {datosFirebase?.historial && datosFirebase.historial.length > 0 ? (
                        [...datosFirebase.historial].reverse().map((registro, index) => (
                          <div key={index} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-3xl">
                                {registro.material === 'Plástico' ? '🧴' :
                                  registro.material === 'Cartón' ? '📦' :
                                    registro.material === 'Vidrio' ? '🍾' : '🥫'}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800 text-lg">Reciclaje de {registro.material}</h4>
                                <p className="text-sm text-slate-500 font-medium mt-1">
                                  {registro.kilos} kg registrados • {new Date(registro.fecha).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="inline-flex items-center bg-green-500 text-white font-bold px-4 py-2 rounded-full text-sm shadow-sm">
                                +{registro.puntos} pts
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-10 text-center text-slate-500">
                          <p className="font-medium text-lg">Aún no tienes actividad.</p>
                          <p className="mt-1">¡Ve a la sección de reciclaje para ganar tus primeros puntos!</p>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              )}

              {/* --- Vista 3: Mis Logros --- */}
              {currentView === 'achievements' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="mb-6">
                    <h2 className="text-3xl font-bold text-slate-800">Mis logros</h2>
                    <p className="text-slate-500 mt-1">Cada acción cuenta. ¡Sigue sumando puntos y cuidando el planeta!</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Tarjeta de Perfil y Nivel */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center md:col-span-1">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-green-500 to-green-300 p-1 mb-4 shadow-md">
                        <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-3xl font-bold text-green-700">
                          {userData?.nombre?.charAt(0) || 'U'}
                        </div>
                      </div>
                      <h3 className="font-bold text-xl text-slate-800">{userData?.nombre || 'Usuario'}</h3>
                      <p className="text-green-600 font-medium text-sm mb-6">{userData?.nivel || 'Nivel 1'}</p>

                      <div className="w-full space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-500">
                          <span>Progreso al Nivel 4</span>
                          <span className="text-green-600">320 / 500 pts</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-green-500 h-2.5 rounded-full" style={{ width: '64%' }}></div>
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta Destacada de Héroe */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-1 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-100 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                      <Award className="w-16 h-16 text-yellow-500 mb-4 relative z-10" />
                      <h4 className="font-bold text-lg text-slate-800 relative z-10">Eco-Héroe</h4>
                      <p className="text-xs text-green-600 font-bold mb-2 relative z-10">¡Felicidades!</p>
                      <p className="text-slate-500 text-sm relative z-10">Has alcanzado el nivel Eco-Héroe por tu compromiso con el reciclaje.</p>
                    </div>

                    {/* Tarjeta de Puntos Totales */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-1 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-green-100">
                        <Leaf className="w-8 h-8 text-green-600" />
                      </div>
                      <h4 className="font-black text-3xl text-slate-800">{userData?.puntosEco?.toLocaleString() || '0'}</h4>
                      <p className="text-slate-500 font-medium mb-4">Puntos Eco</p>
                      <button className="text-sm font-bold text-green-600 hover:text-green-700 flex items-center gap-1">
                        Sigue reciclando <TrendingUp className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Tarjeta de Impacto Ambiental */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-2 flex items-center gap-8">
                      {/* Gráfico circular simulado */}
                      <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                          <circle cx="50" cy="50" r="40" stroke="#16a34a" strokeWidth="12" fill="none" strokeDasharray="251.2" strokeDashoffset="62.8" className="transition-all duration-1000 ease-out" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-2xl font-black text-slate-800">{userData?.co2Ahorrado || 0} kg</span>
                          <span className="text-[10px] font-bold text-slate-500 leading-tight">CO₂<br />ahorrados</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-slate-800 mb-2">Tu impacto ambiental</h4>
                        <p className="text-slate-600 text-sm mb-4">
                          Has evitado la emisión de {userData?.co2Ahorrado || 0} kg de CO₂ gracias a tus acciones de reciclaje constante.
                        </p>
                        <div className="flex items-center gap-2 text-green-700 font-medium bg-green-50 p-3 rounded-lg border border-green-100 w-fit">
                          <Leaf className="w-5 h-5 text-green-600" />
                          <span>Equivale a plantar <strong className="font-bold">{userData?.arbolesEquivalentes || 0} árboles</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta de Insignias */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-1">
                      <h4 className="font-bold text-lg text-slate-800 mb-4">Tus insignias</h4>
                      <div className="grid grid-cols-3 gap-3">
                        {userData?.insignias?.map((badge, index) => (
                          <div key={index} className={`flex flex-col items-center text-center gap-2 p-2 rounded-xl transition-all ${badge.activa ? 'bg-slate-50 hover:bg-green-50 border border-slate-100 cursor-pointer' : 'opacity-40 grayscale'}`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm ${badge.activa ? 'bg-white text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                              {badge.icono === 'Recycle' && <Recycle className="w-6 h-6" />}
                              {badge.icono === 'Award' && <Award className="w-6 h-6 text-yellow-500" />}
                              {badge.icono === 'Globe' && <Globe className="w-6 h-6" />}
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 leading-tight">{badge.nombre}</span>
                            {index === 1 && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 rounded-sm font-bold mt-1">(Actual)</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* VISTA 4: COMUNIDAD */}
              {currentView === 'community' && (
                <div className="max-w-4xl mx-auto mt-8">
                  <div className="mb-8 text-center">
                    <h2 className="text-3xl font-bold text-slate-800">Ranking de la Comunidad</h2>
                    <p className="text-slate-500 mt-2">Descubre quiénes están liderando el cambio ecológico.</p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                      <Trophy className="w-6 h-6 text-amber-500" />
                      <h3 className="font-semibold text-slate-700">Top 10 Recicladores</h3>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {rankingComunidad.map((user, index) => (
                        <div key={index} className={`p-6 flex items-center justify-between ${index < 3 ? 'bg-amber-50/10' : 'hover:bg-slate-50'} transition-colors`}>
                          <div className="flex items-center gap-4">
                            {/* Medalla / Número */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                  ${index === 0 ? 'bg-amber-100 text-amber-600' :
                                index === 1 ? 'bg-slate-200 text-slate-600' :
                                  index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                              #{index + 1}
                            </div>

                            {/* Avatar generado con la inicial */}
                            <img
                              src={`https://ui-avatars.com/api/?name=${user.nombre || 'U'}&background=random`}
                              alt="Perfil"
                              className="w-12 h-12 rounded-full border-2 border-white shadow-sm"
                            />

                            <div>
                              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                {user.nombre || 'Usuario Anónimo'}
                                {index === 0 && <Trophy className="w-4 h-4 text-amber-500" />}
                              </h4>
                              <p className="text-sm text-slate-500">{user.nivel || 'Principiante'}</p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xl font-black text-green-600">{user.puntos || 0}</span>
                            <span className="text-sm text-slate-500 ml-1">pts</span>
                          </div>
                        </div>
                      ))}

                      {rankingComunidad.length === 0 && (
                        <div className="p-10 text-center text-slate-500">
                          Cargando el ranking de la comunidad...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* VISTA 5: CONFIGURACIÓN */}
              {currentView === 'settings' && (
                <div className="max-w-4xl mx-auto mt-8 pb-10">
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-800">Configuración</h2>
                    <p className="text-slate-500 mt-2">Administra tu cuenta y las preferencias de la aplicación.</p>
                  </div>

                  <div className="space-y-6">
                    {/* Sección: Perfil de Usuario */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-6 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-semibold text-slate-700">Información de la Cuenta</h3>
                      </div>
                      <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
                        <img
                          src={usuarioActivo?.photoURL || `https://ui-avatars.com/api/?name=${usuarioActivo?.displayName || 'U'}&background=16a34a&color=fff`}
                          alt="Perfil"
                          className="w-24 h-24 rounded-full border-4 border-green-50 shadow-sm object-cover"
                        />
                        <div className="text-center sm:text-left">
                          <h4 className="text-2xl font-bold text-slate-800">{usuarioActivo?.displayName || 'Usuario EcoRuta'}</h4>
                          <p className="text-slate-500 mb-2">{usuarioActivo?.email || 'correo@ejemplo.com'}</p>
                          <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                            Autenticado con Google
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sección: Preferencias (Visuales) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-6 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-semibold text-slate-700">Preferencias de Notificaciones</h3>
                      </div>
                      <div className="p-6 divide-y divide-slate-100">

                        <div className="py-4 flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-slate-800">Alertas de nuevos puntos</h4>
                            <p className="text-sm text-slate-500">Recibe un aviso cuando se agreguen contenedores cerca.</p>
                          </div>
                          {/* Botón Toggle Encendido */}
                          <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-pointer transition-colors shadow-inner">
                            <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 shadow-sm"></div>
                          </div>
                        </div>

                        <div className="py-4 flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-slate-800">Boletín de Impacto Ambiental</h4>
                            <p className="text-sm text-slate-500">Recibe tu resumen semanal de Puntos Eco por correo.</p>
                          </div>
                          {/* Botón Toggle Apagado */}
                          <div className="w-12 h-6 bg-slate-200 rounded-full relative cursor-pointer transition-colors shadow-inner">
                            <div className="w-4 h-4 bg-white rounded-full absolute top-1 left-1 shadow-sm"></div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Sección: Opciones de Sesión */}
                    <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden mt-8">
                      <div className="p-6 border-b border-red-50 bg-red-50/50">
                        <h3 className="font-semibold text-red-800">Zona de Peligro</h3>
                      </div>
                      <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <h4 className="font-medium text-slate-800">Cerrar Sesión</h4>
                          <p className="text-sm text-slate-500">Saldrás de tu cuenta en este dispositivo. Podrás volver a entrar con Google.</p>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="px-6 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white font-bold rounded-xl transition-colors shadow-sm w-full sm:w-auto"
                        >
                          Cerrar Sesión
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${active
        ? 'bg-green-600 text-white shadow-md'
        : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
    >
      <div className="shrink-0">{icon}</div>
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

function StatCard({ icon, value, label }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0 border border-green-100">
        {icon}
      </div>
      <div>
        <h4 className="text-2xl font-black text-slate-800">{value}</h4>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function MapMarker({ top, left, color, delay }) {
  return (
    <div className="absolute flex items-center justify-center" style={{ top, left, animationDelay: delay }}>
      <div className={`w-6 h-6 ${color} rounded-full flex items-center justify-center shadow-lg border-2 border-white z-10 animate-bounce`} style={{ animationDelay: delay }}>
        <div className="w-2 h-2 bg-white rounded-full"></div>
      </div>
      {/* Sombra del pin */}
      <div className="w-4 h-2 bg-black/20 rounded-full absolute -bottom-1 blur-[1px]"></div>
    </div>
  );
}

function TrazadorDeRutas({ origen, destino }) {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);

  // Configuramos los servicios de rutas de Google
  useEffect(() => {
    if (!routesLibrary || !map) return;
    setDirectionsService(new routesLibrary.DirectionsService());
    // suppressMarkers: true evita que Google dibuje sus propios pines feos de "A" y "B" encima de los nuestros
    setDirectionsRenderer(new routesLibrary.DirectionsRenderer({ map: map, suppressMarkers: true }));
  }, [routesLibrary, map]);

  // Dibujamos la ruta cuando seleccionas un punto
  useEffect(() => {
    if (!directionsService || !directionsRenderer) return;

    if (!origen || !destino) {
      directionsRenderer.setDirections({ routes: [] }); // Borra la línea si deseleccionas
      return;
    }

    directionsService.route({
      origin: origen,
      destination: destino,
      travelMode: 'DRIVING' // Puedes cambiarlo a 'WALKING' si prefieres
    })
      .then(response => {
        directionsRenderer.setDirections(response);
      })
      .catch(e => console.error("Error dibujando la ruta: ", e));
  }, [directionsService, directionsRenderer, origen, destino]);

  return null;
}