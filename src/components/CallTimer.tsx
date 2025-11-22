'use client';

import React, { useState, useEffect } from 'react';

interface CallTimerProps {
  /** Momento en que inició la llamada */
  startTime: Date;
}

/**
 * CallTimer - Componente que muestra el tiempo transcurrido de una llamada
 * Diseñado con font-mono para mejor legibilidad de números
 * Actualiza cada segundo
 * 
 * Características:
 * - Formato mm:ss en números grandes (48px)
 * - Fuente monoespaciada para sincronización clara
 * - Actualización automática cada segundo
 */
export default function CallTimer({ startTime }: CallTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  /**
   * Efecto para actualizar el tiempo transcurrido cada segundo
   */
  useEffect(() => {
    // Calcular tiempo inicial para sincronización correcta
    const now = new Date();
    const initialElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    setElapsed(initialElapsed);

    // Intervalo para actualizar cada segundo
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    // Cleanup del intervalo al desmontar
    return () => clearInterval(interval);
  }, [startTime]);

  /**
   * Formatea los segundos a mm:ss
   */
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex justify-center items-center">
      <span className="font-mono text-6xl sm:text-7xl font-bold text-white tabular-nums tracking-wider">
        {formatTime(elapsed)}
      </span>
    </div>
  );
}