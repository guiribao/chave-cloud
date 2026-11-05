import { TipoEvento } from '@prisma/client';
import { isToday } from 'date-fns';
import { prisma } from '~/secure/db.server';
import { ANUNCIO_INTERVALO_MS, ANUNCIO_MAX_CARACTERES } from './regras-anuncio';

type Resultado = { ok: true } | { ok: false; erro: string };

export async function proximoAnuncioPermitidoEm(eventoFeiranteId: number) {
  const ultimo = await prisma.anuncio_Feira.findFirst({
    where: { eventoFeiranteId },
    orderBy: { criado_em: 'desc' },
    select: { criado_em: true },
  });

  if (!ultimo) return null;

  const proximo = new Date(ultimo.criado_em.getTime() + ANUNCIO_INTERVALO_MS);
  return proximo > new Date() ? proximo : null;
}

/**
 * Lança um anúncio da banca. Regras:
 * - o evento precisa ser uma FEIRA acontecendo hoje;
 * - o feirante (eventoFeiranteId) precisa pertencer ao evento (validar antes de chamar);
 * - mensagem de 1 a 140 caracteres;
 * - no máximo 1 anúncio a cada 5 minutos por banca.
 */
export default async function criarAnuncioFeira({
  eventoId,
  eventoFeiranteId,
  mensagem,
}: {
  eventoId: number;
  eventoFeiranteId: number;
  mensagem: string;
}): Promise<Resultado> {
  const texto = (mensagem || '').replace(/\s+/g, ' ').trim();

  if (!texto) return { ok: false, erro: 'Escreva a mensagem do anúncio.' };
  if (texto.length > ANUNCIO_MAX_CARACTERES)
    return { ok: false, erro: `O anúncio pode ter até ${ANUNCIO_MAX_CARACTERES} caracteres.` };

  const evento = await prisma.eventos.findUnique({
    where: { id: eventoId },
    select: { tipo: true, data_hora: true },
  });

  if (!evento || evento.tipo !== TipoEvento.FEIRA)
    return { ok: false, erro: 'Evento não encontrado.' };

  if (!isToday(evento.data_hora))
    return { ok: false, erro: 'Os anúncios só podem ser feitos no dia da feira.' };

  const proximo = await proximoAnuncioPermitidoEm(eventoFeiranteId);
  if (proximo) {
    const minutos = Math.ceil((proximo.getTime() - Date.now()) / 60000);
    return {
      ok: false,
      erro: `Aguarde ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} para fazer um novo anúncio.`,
    };
  }

  await prisma.anuncio_Feira.create({
    data: { eventoId, eventoFeiranteId, mensagem: texto },
  });

  return { ok: true };
}
