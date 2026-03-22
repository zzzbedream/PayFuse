import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

// ── Types ───────────────────────────────────────────

export interface RutValidationResult {
  isValid: boolean;
  rut: string;
  formattedRut: string;
  name?: string;
  economicActivity?: string;
  error?: string;
}

// ── SII (Servicio de Impuestos Internos) Service ────

export class SIIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.SII_API_URL,
      timeout: 15_000,
      headers: config.SII_API_KEY
        ? { Authorization: `Bearer ${config.SII_API_KEY}` }
        : undefined,
    });
  }

  // ── RUT Validation ────────────────────────────────

  /**
   * Validate a Chilean RUT (Rol Único Tributario) format locally.
   * Does NOT require an external API call.
   */
  validateRutFormat(rut: string): { isValid: boolean; formatted: string } {
    const cleaned = rut.replace(/[.\-]/g, '').toUpperCase();

    if (cleaned.length < 2) return { isValid: false, formatted: '' };

    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1);

    if (!/^\d+$/.test(body)) return { isValid: false, formatted: '' };

    const expectedDv = this.calculateDV(parseInt(body, 10));
    const isValid = expectedDv === dv;

    const formatted = this.formatRut(body, dv);
    return { isValid, formatted };
  }

  /**
   * Verify a RUT against the SII API to get taxpayer information.
   * Falls back to local validation if the API is unavailable.
   */
  async verifyRut(rut: string): Promise<RutValidationResult> {
    const local = this.validateRutFormat(rut);
    if (!local.isValid) {
      return {
        isValid: false,
        rut,
        formattedRut: '',
        error: 'Invalid RUT format or check digit',
      };
    }

    // If no API key is configured, return local validation only
    if (!config.SII_API_KEY) {
      return {
        isValid: true,
        rut,
        formattedRut: local.formatted,
      };
    }

    // Query external SII API for taxpayer details
    try {
      const cleaned = rut.replace(/[.\-]/g, '');
      const { data } = await this.client.get(`/sii/contribuyentes/${cleaned}`);

      return {
        isValid: true,
        rut,
        formattedRut: local.formatted,
        name: data.razon_social || data.nombre,
        economicActivity: data.actividad_economica,
      };
    } catch (err) {
      // API unavailable — fall back to local validation
      const msg = err instanceof Error ? err.message : 'SII API unavailable';
      console.warn(`[SII] API query failed: ${msg} — using local validation`);

      return {
        isValid: true,
        rut,
        formattedRut: local.formatted,
        error: 'SII API unavailable — validated format only',
      };
    }
  }

  // ── Helpers ───────────────────────────────────────

  /**
   * Calculate the verification digit (dígito verificador) for a RUT.
   * Uses the standard Módulo 11 algorithm.
   */
  private calculateDV(rutBody: number): string {
    let sum = 0;
    let multiplier = 2;

    let n = rutBody;
    while (n > 0) {
      sum += (n % 10) * multiplier;
      n = Math.floor(n / 10);
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const remainder = 11 - (sum % 11);

    if (remainder === 11) return '0';
    if (remainder === 10) return 'K';
    return remainder.toString();
  }

  /**
   * Format a RUT as XX.XXX.XXX-D
   */
  private formatRut(body: string, dv: string): string {
    const reversed = body.split('').reverse();
    const groups: string[] = [];

    for (let i = 0; i < reversed.length; i += 3) {
      groups.push(reversed.slice(i, i + 3).reverse().join(''));
    }

    return groups.reverse().join('.') + '-' + dv;
  }
}

export const siiService = new SIIService();
