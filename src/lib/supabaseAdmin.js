import { createClient } from '@supabase/supabase-js'

// Este cliente usa la SERVICE ROLE KEY — bypasa RLS.
// Solo usar en módulos protegidos por rol "admin".
// Requiere VITE_SUPABASE_SERVICE_KEY en .env.local
//   (encontrala en Supabase → Project Settings → API → service_role key)
// ADVERTENCIA: en producción mover estas operaciones a Edge Functions.

const url     = import.meta.env.VITE_SUPABASE_URL
const svcKey  = import.meta.env.VITE_SUPABASE_SERVICE_KEY

export const supabaseAdmin = svcKey
  ? createClient(url, svcKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null
