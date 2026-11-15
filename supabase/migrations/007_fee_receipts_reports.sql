-- Smart Minds: automatic receipt numbers for fee payments
-- Existing payment records are preserved and receive a receipt number.

CREATE SEQUENCE IF NOT EXISTS public.smart_minds_receipt_number_seq START WITH 1;

ALTER TABLE public.fee_payments
  ADD COLUMN IF NOT EXISTS receipt_number text;

UPDATE public.fee_payments
SET receipt_number =
  'SM-' || to_char(payment_date, 'YYYY') || '-' ||
  lpad(nextval('public.smart_minds_receipt_number_seq')::text, 6, '0')
WHERE receipt_number IS NULL;

ALTER TABLE public.fee_payments
  ALTER COLUMN receipt_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS fee_payments_receipt_number_unique
  ON public.fee_payments (receipt_number);

CREATE OR REPLACE FUNCTION public.assign_fee_payment_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR btrim(NEW.receipt_number) = '' THEN
    NEW.receipt_number :=
      'SM-' || to_char(COALESCE(NEW.payment_date, CURRENT_DATE), 'YYYY') || '-' ||
      lpad(nextval('public.smart_minds_receipt_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fee_payment_receipt_number_trigger ON public.fee_payments;

CREATE TRIGGER fee_payment_receipt_number_trigger
BEFORE INSERT ON public.fee_payments
FOR EACH ROW
EXECUTE FUNCTION public.assign_fee_payment_receipt_number();

