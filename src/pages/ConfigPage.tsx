import { useEffect, useState } from 'react'
import { useAuth } from '../features/auth/useAuth'
import type { InventoryRole } from '../features/auth/AuthContext'
import { supabase } from '../lib/supabase'

type Profile = {
  id: string
  display_name: string
  role: InventoryRole
  updated_at: string
}

const roleLabels: Record<InventoryRole, string> = {
  admin: 'Administrador (Control total)',
  operator: 'Operador (Edita inventario)',
  viewer: 'Consulta (Solo lectura)',
}

function ConfiguracionPage() {
  const { user, profile, signOut } = useAuth()
  const [usersList, setUsersList] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pageMessage, setPageMessage] = useState('')

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    let isMounted = true

    async function loadUsers() {
      if (!isAdmin) return
      
      setIsLoading(true)
      // Como eres admin, tus políticas RLS en Supabase te permiten ver toda la tabla
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, role, updated_at')
        .order('role', { ascending: true })

      if (!isMounted) return

      if (error) {
        setPageMessage('Error al cargar la lista de usuarios.')
      } else {
        setUsersList(data as Profile[])
      }
      setIsLoading(false)
    }

    void loadUsers()

    return () => {
      isMounted = false
    }
  }, [isAdmin])

  async function handleRoleChange(userId: string, newRole: InventoryRole) {
    setPageMessage('')
    
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      setPageMessage('No fue posible actualizar el rol del usuario.')
      return
    }

    setUsersList((current) =>
      current.map((p) => (p.id === userId ? { ...p, role: newRole, updated_at: new Date().toISOString() } : p))
    )
    setPageMessage('Permisos actualizados correctamente.')
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Ajustes del sistema</p>
          <h2>Configuración</h2>
          <p>
            Gestiona tu cuenta, los permisos de los miembros del equipo y consulta 
            el estado general de la plataforma.
          </p>
        </div>
      </div>

      {pageMessage && (
        <div className="inline-message" role="status">
          {pageMessage}
        </div>
      )}

      <div className="settings-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '800px' }}>
        
        {/* BLOQUE 1: MI CUENTA */}
        <article className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Perfil personal</p>
            <h3>Mi Cuenta</h3>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>{profile?.display_name ?? 'Usuario'}</p>
              <p style={{ margin: '0 0 4px 0', color: '#64748b' }}>✉️ {user?.email}</p>
              <p style={{ margin: 0, color: '#64748b' }}>
                🛡️ Nivel de acceso: <strong style={{ color: '#0f172a' }}>{profile?.role ? roleLabels[profile.role] : 'Sin perfil'}</strong>
              </p>
            </div>
            
            <button 
              className="secondary-button" 
              onClick={() => void signOut()} 
              style={{ color: '#ef4444', borderColor: '#fecaca' }}
            >
              Cerrar sesión
            </button>
          </div>
        </article>

        {/* BLOQUE 2: GESTIÓN DE USUARIOS (SOLO ADMIN) */}
        {isAdmin && (
          <article className="panel">
            <div className="panel-heading">
              <p className="eyebrow">Control de accesos</p>
              <h3>Gestión de Usuarios</h3>
            </div>
            <p style={{ fontSize: '0.95rem', color: '#64748b', marginBottom: '16px' }}>
              Como administrador, puedes promover cuentas nuevas a Operadores para que puedan editar el inventario y hacer reportes.
            </p>

            {isLoading ? (
              <p>Cargando usuarios...</p>
            ) : (
              <div className="users-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {usersList.map((usr) => (
                  <div key={usr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div>
                      <strong style={{ display: 'block' }}>{usr.display_name}</strong>
                      <small style={{ color: '#64748b' }}>Última actualización: {new Date(usr.updated_at).toLocaleDateString()}</small>
                    </div>
                    
                    <div>
                      <select 
                        value={usr.role} 
                        onChange={(e) => void handleRoleChange(usr.id, e.target.value as InventoryRole)}
                        disabled={usr.id === user?.id} // El admin no debería quitarse los permisos a sí mismo por error
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: usr.id === user?.id ? '#f1f5f9' : '#fff' }}
                      >
                        <option value="viewer">Consulta</option>
                        <option value="operator">Operador</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        )}

        {/* BLOQUE 3: INFORMACIÓN DEL SISTEMA */}
        <article className="panel" style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
          <div className="panel-heading">
            <p className="eyebrow">Infraestructura</p>
            <h3>Información del Sistema</h3>
          </div>
          
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: 0, fontSize: '0.9rem' }}>
            <div>
              <dt style={{ color: '#64748b', marginBottom: '4px' }}>Versión de la plataforma</dt>
              <dd style={{ margin: 0, fontWeight: '500' }}>v1.0.0 (Release Candidate)</dd>
            </div>
            <div>
              <dt style={{ color: '#64748b', marginBottom: '4px' }}>Motor de Base de Datos</dt>
              <dd style={{ margin: 0, fontWeight: '500' }}>PostgreSQL 17.6</dd>
            </div>
            <div>
              <dt style={{ color: '#64748b', marginBottom: '4px' }}>Estado del Proxy (API)</dt>
              <dd style={{ margin: 0, fontWeight: '500', color: '#16a34a' }}>En línea (Healthy)</dd>
            </div>
            <div>
              <dt style={{ color: '#64748b', marginBottom: '4px' }}>Región del Servidor</dt>
              <dd style={{ margin: 0, fontWeight: '500' }}>Nube administrada</dd>
            </div>
          </dl>
        </article>

      </div>
    </section>
  )
}

export default ConfiguracionPage