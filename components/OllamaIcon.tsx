import React from 'react';

export const OllamaIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => {
  // Use a ratio that matches the requested 34px height for 22px size (approx 1.545)
  const height = size * (34 / 22);

  return (
    <img 
      src="/public/media/ollama.svg" 
      alt="Ollama" 
      className={className}
      style={{
        fontSize: '15px',
        height: `${height}px`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    />
  );
};
