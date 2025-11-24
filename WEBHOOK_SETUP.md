# 🔗 Configuración del Webhook de ElevenLabs

## ⚠️ IMPORTANTE

Para que las transcripciones se guarden en Supabase, **DEBES configurar el webhook en ElevenLabs**.

---

## 📋 Paso a Paso

### 1. Ve al Dashboard de ElevenLabs

URL: https://elevenlabs.io/app/conversational-ai

### 2. Selecciona tu Agente

- Busca el agente: `agent_5701kasyx2p6efwv14aq24zwbn64`
- Haz clic en él para abrirlo

### 3. Ve a la Configuración del Agente

- Busca la sección **"Webhooks"** o **"Integrations"**
- O ve a la pestaña **"Settings"** del agente

### 4. Configura el Webhook URL

Añade la siguiente URL:

**Producción (Vercel):**
```
https://TU-DOMINIO.vercel.app/api/webhooks/elevenlabs
```

**Desarrollo local:**
```
http://localhost:3000/api/webhooks/elevenlabs
```

> **Nota:** Para desarrollo local, necesitarás usar ngrok o similar para exponer tu localhost.

### 5. Configura el Shared Secret

Usa este valor exacto:
```
wsec_1f1d30927010aad13fda51b43051f8e81c058e4d422c2dbca53f03739dd67226
```

### 6. Selecciona los Eventos

Asegúrate de que esté marcado:
- ✅ **`post_conversation_evaluation`** o **`conversation.ended`**
- ✅ **`conversation.completed`** (si está disponible)

Estos eventos se disparan cuando termina una conversación y contienen la transcripción.

### 7. Guarda la Configuración

Haz clic en **"Save"** o **"Update"**.

---

## 🧪 Verificar que Funciona

### Opción 1: Hacer una Llamada de Prueba

1. Ve a tu aplicación
2. Inicia una llamada
3. Habla algo y termina la llamada
4. Espera 10-30 segundos
5. Verifica en los logs de Vercel o en Supabase si se guardó la transcripción

### Opción 2: Verificar el Endpoint

Abre en el navegador:
```
https://TU-DOMINIO.vercel.app/api/webhooks/elevenlabs
```

Deberías ver:
```json
{
  "status": "ok",
  "endpoint": "/api/webhooks/elevenlabs",
  "description": "Webhook para recibir transcripciones de ElevenLabs",
  ...
}
```

### Opción 3: Endpoint de Testing

```
https://TU-DOMINIO.vercel.app/api/webhooks/elevenlabs/test
```

Verás las últimas llamadas y transcripciones.

---

## 🔍 Debugging

### Ver Logs en Vercel

```bash
vercel logs https://TU-DOMINIO.vercel.app --follow
```

Cuando se reciba un webhook, verás:
```
🔔 [Webhook] WEBHOOK RECIBIDO DE ELEVENLABS
🔑 Conversation ID recibido: abc123...
✅ Llamada encontrada: xxx
✅ Transcripción guardada correctamente
```

### Si NO se recibe el webhook:

1. **Verifica la URL del webhook en ElevenLabs**
   - Debe terminar en `/api/webhooks/elevenlabs`
   - Sin espacios ni caracteres extra

2. **Verifica el Shared Secret**
   - Debe coincidir exactamente con el de `.env.local`

3. **Verifica que el agente tenga webhooks habilitados**
   - Algunos planes de ElevenLabs no incluyen webhooks

### Si el webhook se recibe pero no encuentra la llamada:

1. **Revisa los logs** - verás algo como:
   ```
   ❌ Llamada NO encontrada para conversation_id: abc123
   📋 Últimas 5 llamadas en BD: [...]
   ```

2. **Problema:** El `conversation_id` que envía ElevenLabs no coincide con el que guardamos

3. **Solución:** Verifica en los logs del frontend (cuando se inicia la llamada):
   ```
   🔑 GUARDANDO CONVERSATION_ID EN BD
   - Conversation ID: xyz789
   ```

   Y compáralo con el que llega en el webhook.

---

## 📝 Formato del Webhook de ElevenLabs

ElevenLabs envía algo así:

```json
{
  "type": "post_conversation_evaluation",
  "conversation_id": "abc123...",
  "agent_id": "agent_5701kasyx2p6efwv14aq24zwbn64",
  "status": "done",
  "transcript": [
    {
      "role": "user",
      "message": "Hola",
      "timestamp": "2025-11-24T10:00:00Z"
    },
    {
      "role": "agent",
      "message": "¡Hola! ¿Cómo puedo ayudarte?",
      "timestamp": "2025-11-24T10:00:02Z"
    }
  ],
  "metadata": {...},
  "analysis": {...}
}
```

---

## ✅ Checklist

Antes de que funcione, asegúrate de que:

- [ ] Webhook URL configurada en ElevenLabs
- [ ] Shared Secret configurado correctamente
- [ ] Eventos `post_conversation_evaluation` seleccionados
- [ ] Variables de entorno en Vercel configuradas:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `WEBHOOK_SHARED_SECRET`
- [ ] Al menos una llamada de prueba realizada

---

## 🆘 Soporte

Si después de todo esto no funciona:

1. Revisa los logs de Vercel
2. Revisa la tabla `calls` en Supabase
3. Verifica que `elevenlabs_conversation_id` no esté vacío
4. Contacta con soporte de ElevenLabs para verificar que los webhooks estén habilitados

---

## 📚 Documentación Oficial

- [ElevenLabs Webhooks Documentation](https://elevenlabs.io/docs/api-reference/webhooks)
- [Conversational AI Webhooks](https://elevenlabs.io/docs/conversational-ai/webhooks)
