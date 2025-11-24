## ✅ CONFIGURACIÓN ACTUALIZADA

### Variables de entorno corregidas:

```bash
# ✅ Agent ID correcto (extraído de la URL)
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=agent_5701kasyx2p6efwv14aq24zwbn64

# ✅ API Key correcta (formato sk_...)
ELEVENLABS_API_KEY=sk_d997091a12a6510a6af621c6ef97ab704b148cab4f39187e
```

### Cambios aplicados:

1. ✅ **Agent ID**: Extraído de la URL completa → `agent_5701kasyx2p6efwv14aq24zwbn64`
2. ✅ **API Key**: Actualizada a la versión válida con formato `sk_...`
3. ✅ **Webhook Secret**: Actualizado al nuevo valor

---

# 🔧 Configuración de ElevenLabs

## ❌ Error Actual
```
Error 401: Invalid API key
```

## ✅ Solución

### Paso 1: Obtener tu API Key de ElevenLabs

1. **Ve a ElevenLabs Dashboard**
   - URL: https://elevenlabs.io/app/settings/api-keys
   - O: https://elevenlabs.io/ → Login → Settings → API Keys

2. **Genera una nueva API Key**
   - Click en "Create API Key" o "Generate New Key"
   - Dale un nombre descriptivo (ej: "RecuerdaMVP")
   - **COPIA LA KEY INMEDIATAMENTE** (solo se muestra una vez)

3. **Formato esperado**
   - La API Key debería verse algo como:
   - `sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (empieza con `sk_`)
   - O un formato hexadecimal largo (64+ caracteres)

### Paso 2: Actualizar `.env.local`

Reemplaza la línea actual en tu archivo `.env.local`:

```bash
# ❌ ACTUAL (INCORRECTA)
ELEVENLABS_API_KEY=0d20576765899f3df806931f7755272f8d1f547f2cd96400eef0bb98b910669f

# ✅ NUEVA (reemplaza con tu API Key real)
ELEVENLABS_API_KEY=sk_tu_api_key_aqui
```

**IMPORTANTE:** También actualiza esta línea:
```bash
NEXT_PUBLIC_ELEVENLABS_API_KEY=sk_tu_api_key_aqui
```

### Paso 3: Verificar el Agent ID

Tu Agent ID actual es: `agent_8101k9nytxf0f3v8hag5mk20mw52`

Verifica que este Agent ID exista en tu cuenta de ElevenLabs:
1. Ve a: https://elevenlabs.io/app/conversational-ai
2. Busca tu agente
3. Copia el Agent ID correcto

### Paso 4: Reiniciar el servidor

Después de actualizar `.env.local`:

```bash
# Detener el servidor (Ctrl+C)
# Reiniciar
npm run dev
```

### Paso 5: Probar la conexión

Intenta iniciar una llamada nuevamente. Deberías ver en la consola:

```
[API] ✅ Variables de entorno OK
[ElevenLabs] Signed URL obtenida exitosamente
```

## 📝 Archivo `.env.local` completo esperado

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://uzrdoceqgcmluranqdxe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ElevenLabs - CLIENTE (se expone al frontend)
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=agent_8101k9nytxf0f3v8hag5mk20mw52
NEXT_PUBLIC_ELEVENLABS_API_KEY=sk_TU_API_KEY_AQUI

# ElevenLabs - SERVIDOR (solo backend, MÁS SEGURO)
ELEVENLABS_API_KEY=sk_TU_API_KEY_AQUI

# Webhook
WEBHOOK_SHARED_SECRET=wsec_0e02049ffbb9389f6c9eac61d805864740bccc965cae268
```

## 🔍 Debugging

Si sigues teniendo problemas, verifica en la consola del servidor:

```
[API] - API Key length: 64  # Debería ser > 30
[API] - API Key format: sk_1234567...  # Debería empezar con sk_
```

## 🔗 Enlaces útiles

- Dashboard: https://elevenlabs.io/app
- API Keys: https://elevenlabs.io/app/settings/api-keys
- Agents: https://elevenlabs.io/app/conversational-ai
- Documentación: https://elevenlabs.io/docs/api-reference/conversational-ai
