import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'leaflet/dist/leaflet.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import Acompanhar, { BuscarProtocolo } from './cidadao/Acompanhar'
import Inicio from './cidadao/Inicio'
import Relatar from './cidadao/Relatar'
import './index.css'
import Painel from './painel/Painel'

const cliente = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/relatar" element={<Relatar />} />
          <Route path="/acompanhar" element={<BuscarProtocolo />} />
          <Route path="/acompanhar/:protocolo" element={<Acompanhar />} />
          <Route path="/painel/*" element={<Painel />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
