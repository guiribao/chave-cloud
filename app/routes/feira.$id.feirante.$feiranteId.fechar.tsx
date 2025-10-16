//@ts-nocheck
import { Papel } from '@prisma/client';
import { LoaderFunctionArgs } from '@remix-run/node';
import pegarFeirantesPorFeira from '~/domain/Calendario/pegar-feirantes-por-feiras.server';
import buscarPerfil from '~/domain/Perfil/buscar-perfil.server';
import pegarPerfilPeloIdUsuario from '~/domain/Perfil/perfil-pelo-id-usuario.server';
import { authenticator } from '~/secure/authentication.server';

export async function loader({ request, params }: LoaderFunctionArgs) {
  let usuario: Usuario = await authenticator.isAuthenticated(request, {
    failureRedirect: '/autentica/entrar',
  });

  const { id, feiranteId } = params;

  let perfil = await pegarPerfilPeloIdUsuario(usuario.id)

  if (usuario.papel != Papel.ADMIN && perfil.id != feiranteId) {
    return new Response(JSON.stringify({ "message": "Permissão negada." }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
