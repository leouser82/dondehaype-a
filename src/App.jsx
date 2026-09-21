import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Buscar from './pages/Buscar'
import DetallePena from './pages/DetallePena'
import Home from './pages/Home'
import NuevaPena from './pages/NuevaPena'

export default function App() {
  return (
    <div className="app-shell">
      <div className="wood-bar" />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/buscar" element={<Buscar />} />
          <Route path="/nueva" element={<NuevaPena />} />
          <Route path="/pena/:id" element={<DetallePena />} />
        </Routes>
      </main>
      <footer>
        Donde hay peña · colaborativo, rural y de fogón. Las peñas vencidas se ocultan solas.
      </footer>
    </div>
  )
}
