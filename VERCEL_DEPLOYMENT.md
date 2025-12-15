# 🚀 Despliegue en Vercel

## Variables de Entorno Requeridas

Después de desplegar en Vercel, configura estas variables de entorno en:
**Settings → Environment Variables**

### 1. Supabase

```
NEXT_PUBLIC_SUPABASE_URL=https://uzrdoceqgcmluranqdxe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6cmRvY2VxZ2NtbHVyYW5xZHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxOTk1MjUsImV4cCI6MjA3Nzc3NTUyNX0.TyVz-b_-p4qA888ufUfmBItJ8cELtpwvMdx4bT7v5C8
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6cmRvY2VxZ2NtbHVyYW5xZHhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjE5OTUyNSwiZXhwIjoyMDc3Nzc1NTI1fQ.rTLHgxc9UVbGedORijfZ9gUBtXVsEw0Znt9MvS9eH94
```

### 2. ElevenLabs

```
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=agent_9001k9d86gj2f0wbvsbxmssdx87m
NEXT_PUBLIC_ELEVENLABS_API_KEY=sk_8d05c6d6affb06722e8b4944701fbbe7b77c120845b34a8f
ELEVENLABS_API_KEY=sk_8d05c6d6affb06722e8b4944701fbbe7b77c120845b34a8f
```

### 3. Webhook

```
WEBHOOK_SHARED_SECRET=wsec_1f1d30927010aad13fda51b43051f8e81c058e4d422c2dbca53f03739dd67226
```

## 📝 Pasos para Desplegar

### 1. Subir a GitHub (ya hecho)
```bash
git add .
git commit -m "feat: integración completa de ElevenLabs con validaciones y manejo de errores"
git push origin main
```

### 2. Conectar con Vercel
1. Ve a [vercel.com](https://vercel.com)
2. Haz clic en **"Add New Project"**
3. Importa tu repositorio de GitHub
4. Vercel detectará automáticamente que es un proyecto Next.js

### 3. Configurar Variables de Entorno
1. En el paso de configuración, haz clic en **"Environment Variables"**
2. Pega cada variable una por una (formato: `NOMBRE=valor`)
3. Asegúrate de marcar todas las variables como disponibles para:
   - ✅ Production
   - ✅ Preview
   - ✅ Development (opcional)

### 4. Desplegar
1. Haz clic en **"Deploy"**
2. Espera unos minutos mientras Vercel construye y despliega tu aplicación
3. Una vez completado, obtendrás una URL como: `https://mi-mvp-recurdame.vercel.app`

### 5. Configurar Webhooks de ElevenLabs

Una vez desplegado en Vercel, actualiza la URL del webhook en ElevenLabs:

1. Ve a [ElevenLabs Dashboard](https://elevenlabs.io/app/conversational-ai)
2. Selecciona tu agente
3. Ve a **Settings → Webhooks**
4. Configura la URL del webhook:
   ```
   https://TU-DOMINIO.vercel.app/api/webhooks/elevenlabs
   ```
5. Usa el **Shared Secret**: `wsec_1f1d30927010aad13fda51b43051f8e81c058e4d422c2dbca53f03739dd67226`

## 🔍 Verificación Post-Despliegue

### 1. Verificar que la API funciona
Abre en el navegador:
```
https://TU-DOMINIO.vercel.app/api/elevenlabs/session
```

Deberías ver una respuesta JSON con `signed_url`.

### 2. Verificar que el webhook funciona
En ElevenLabs, haz una llamada de prueba y verifica que:
- La transcripción se guarda en Supabase
- No hay errores en los logs de Vercel

### 3. Ver logs en tiempo real
```
vercel logs https://TU-DOMINIO.vercel.app --follow
```

## 🐛 Troubleshooting

### Error 401 en Vercel
- ✅ Verifica que `ELEVENLABS_API_KEY` esté configurada
- ✅ Asegúrate de que empiece con `sk_`
- ✅ Redespliega después de añadir variables de entorno

### Error 404 en API routes
- ✅ Verifica que `src/app/api/...` tenga archivos `route.ts`
- ✅ Vercel usa Next.js App Router automáticamente

### Webhook no recibe datos
- ✅ Verifica que la URL del webhook en ElevenLabs sea correcta
- ✅ Debe ser: `https://TU-DOMINIO.vercel.app/api/webhooks/elevenlabs`
- ✅ Sin espacios ni caracteres especiales

## 📊 Monitoreo

Una vez desplegado, puedes monitorear:
- **Vercel Dashboard**: Ver despliegues, logs, analytics
- **Supabase Dashboard**: Ver datos de llamadas y transcripciones
- **ElevenLabs Dashboard**: Ver uso de API y llamadas realizadas

## 🔄 Redeploy Automático

Cada vez que hagas `git push` a tu rama principal:
1. Vercel detectará los cambios automáticamente
2. Construirá una nueva versión
3. La desplegará en producción
4. Te enviará una notificación por email

## 🎯 URLs Importantes

- **Producción**: `https://TU-DOMINIO.vercel.app`
- **API Session**: `https://TU-DOMINIO.vercel.app/api/elevenlabs/session`
- **Webhook**: `https://TU-DOMINIO.vercel.app/api/webhooks/elevenlabs`
- **Dashboard Vercel**: `https://vercel.com/dashboard`
