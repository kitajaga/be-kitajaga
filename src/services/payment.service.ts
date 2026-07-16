import axios from 'axios';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface SnapResponse {
  token: string;
  redirect_url: string;
}

export async function requestSnapToken(
  bookingId: string,
  amount: number
): Promise<{ token: string; redirectUrl: string }> {
  try {
    const serverKey = env.MIDTRANS_SERVER_KEY.trim();
    const authHeader = Buffer.from(`${serverKey}:`).toString('base64');
    
    // Call Midtrans Snap Sandbox API
    const response = await axios.post<SnapResponse>(
      'https://app.sandbox.midtrans.com/snap/v1/transactions',
      {
        transaction_details: {
          order_id: bookingId,
          gross_amount: amount,
        },
        credit_card: {
          secure: true,
        },
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Basic ${authHeader}`,
        },
      }
    );

    return {
      token: response.data.token,
      redirectUrl: response.data.redirect_url,
    };
  } catch (err: any) {
    logger.warn('Midtrans Snap request failed, falling back to mock token for demo:', err?.response?.data || err.message);
    
    // Fallback to mock Snap token for seamless hackathon demo/testing
    const mockToken = `mock-snap-token-${bookingId}`;
    return {
      token: mockToken,
      redirectUrl: `https://app.sandbox.midtrans.com/snap/v2/vtweb/${mockToken}`,
    };
  }
}

export function verifySignature(body: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}): boolean {
  if (!body.order_id || !body.status_code || !body.gross_amount || !body.signature_key) {
    return false;
  }
  
  const serverKey = env.MIDTRANS_SERVER_KEY.trim();
  const payload = body.order_id + body.status_code + body.gross_amount + serverKey;
  const hash = crypto.createHash('sha512').update(payload).digest('hex');
  
  logger.info(`verifySignature - Payload: "${payload}"`);
  logger.info(`verifySignature - Generated Hash: "${hash}"`);
  logger.info(`verifySignature - Received Hash:  "${body.signature_key}"`);
  
  return hash === body.signature_key;
}
