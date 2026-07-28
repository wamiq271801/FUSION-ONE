import { NextRequest, NextResponse } from 'next/server';
import { addFunds } from '@/platform/services/accounts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bank_account_id, amount, date, notes, financial_year_id } = body;

    if (!bank_account_id)     return NextResponse.json({ error: 'Bank account is required'       }, { status: 400 });
    if (!financial_year_id)   return NextResponse.json({ error: 'Financial year is required'     }, { status: 400 });
    if (!date)                return NextResponse.json({ error: 'Date is required'               }, { status: 400 });

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0)
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });

    const result = await addFunds({ bank_account_id, amount: numAmount, date, notes, financial_year_id });
    return NextResponse.json({ success: true, id: result.id });
  } catch (err: any) {
    console.error('Add Funds Error:', err);
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status });
  }
}
