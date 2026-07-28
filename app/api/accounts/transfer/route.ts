import { NextRequest, NextResponse } from 'next/server';
import { transferFunds } from '@/platform/services/accounts';
import { createClient } from '@/platform/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { from_bank_account_id, to_bank_account_id, amount, date, notes, financial_year_id } = body;

    if (!from_bank_account_id)  return NextResponse.json({ error: 'Source account is required'      }, { status: 400 });
    if (!to_bank_account_id)    return NextResponse.json({ error: 'Destination account is required' }, { status: 400 });
    if (!financial_year_id)     return NextResponse.json({ error: 'Financial year is required'      }, { status: 400 });
    if (!date)                  return NextResponse.json({ error: 'Date is required'                }, { status: 400 });

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0)
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });

    const result = await transferFunds({
      from_bank_account_id, to_bank_account_id,
      amount: numAmount, date, notes, financial_year_id,
    });
    return NextResponse.json({ success: true, id: result.id });
  } catch (err: any) {
    console.error('Transfer Funds Error:', err);
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status });
  }
}
