-- Adicionar coluna valor_unitario na tabela coletados
ALTER TABLE public.coletados
ADD COLUMN valor_unitario numeric DEFAULT 0;
-- Atualizar linhas existentes com valor da tabela base (opcional, mas recomendado)
UPDATE public.coletados c
SET valor_unitario = b.valor_unitario
FROM public.base b
WHERE c.produto_id = b.id;