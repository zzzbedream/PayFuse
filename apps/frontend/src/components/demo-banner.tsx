'use client';

export default function DemoBanner() {
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (!isDemo) return null;

    return (
        <div
            style={{
                background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
                color: '#1a1a1a',
                padding: '10px 20px',
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.01em',
                position: 'sticky',
                top: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
            }}
        >
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <span>
                Demo Mode — Actualmente en fase de pruebas. El sistema funciona
                completamente en entorno local y pronto estará disponible en Fuse Spark
                testnet.{' '}
                <a
                    href="https://github.com/zzzbedream/PayFuse"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        color: '#1a1a1a',
                        textDecoration: 'underline',
                        fontWeight: 700,
                    }}
                >
                    Ver repositorio →
                </a>
            </span>
        </div>
    );
}
