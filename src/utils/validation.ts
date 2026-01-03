import { z } from 'zod';

/**
 * Common validation schemas for the application
 */

// User authentication
export const emailSchema = z
  .string()
  .trim()
  .email('E-mail inválido')
  .max(255, 'E-mail muito longo');

export const passwordSchema = z
  .string()
  .min(6, 'Senha deve ter no mínimo 6 caracteres')
  .max(72, 'Senha muito longa'); // bcrypt limit

export const nomeSchema = z
  .string()
  .trim()
  .min(2, 'Nome deve ter no mínimo 2 caracteres')
  .max(100, 'Nome muito longo');

// Business data
export const cnpjSchema = z
  .string()
  .optional()
  .refine(
    (val) => !val || val.replace(/\D/g, '').length === 14,
    'CNPJ deve ter 14 dígitos'
  );

export const telefoneSchema = z
  .string()
  .optional()
  .refine(
    (val) => !val || val.replace(/\D/g, '').length >= 10,
    'Telefone inválido'
  );

export const precoSchema = z
  .number()
  .positive('Preço deve ser positivo')
  .max(999999.99, 'Preço muito alto');

export const quantidadeSchema = z
  .number()
  .int('Quantidade deve ser inteiro')
  .positive('Quantidade deve ser positiva')
  .max(9999, 'Quantidade muito alta');

// Form schemas
export const loginFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupFormSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const produtoFormSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  descricao: z.string().max(500, 'Descrição muito longa').optional(),
  preco: precoSchema,
  categoria_id: z.string().uuid().optional().nullable(),
  ativo: z.boolean(),
});

export const categoriaFormSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(50, 'Nome muito longo'),
  descricao: z.string().max(200, 'Descrição muito longa').optional(),
});

export const mesaFormSchema = z.object({
  numero_mesa: z.number().int().positive('Número inválido').max(9999, 'Número muito alto'),
  capacidade: z.number().int().positive('Capacidade inválida').max(100, 'Capacidade muito alta'),
});

export const membroEquipeSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  senha: passwordSchema,
  role: z.enum(['proprietario', 'gerente', 'garcom', 'caixa']),
});

export const empresaFormSchema = z.object({
  nome_fantasia: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  cnpj: cnpjSchema,
  endereco_completo: z.string().max(500, 'Endereço muito longo').optional(),
  inscricao_estadual: z.string().max(30, 'Inscrição estadual muito longa').optional(),
});

/**
 * Helper function to validate form data with a schema
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map((err) => err.message);
  return { success: false, errors };
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Validate and sanitize numeric input
 */
export function parsePositiveNumber(value: string | number): number | null {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num < 0) return null;
  return num;
}
