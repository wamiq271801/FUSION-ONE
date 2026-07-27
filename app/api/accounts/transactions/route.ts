import { NextRequest, NextResponse } from 'next/server';
import { getTransactions } from '@/server/services/accounts';

export async function GET(req: NextRequest) {
  try {
    const { searchParams }  = new URL(req.url);
    const bank_account_id   = searchParams.get('bank_account_id');
    const financial_year_id = searchParams.get('financial_year_id');

    if (!bank_account_id || !financial_year_id)
      return NextResponse.json({ error: 'bank_account_id and financial_year_id are required' }, { status: 400 });

    const transactions = await getTransactions(bank_account_id, financial_year_id);
    return NextResponse.json({ transactions });
  } catch (err: any) {
    console.error('Fetch Transactions Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
