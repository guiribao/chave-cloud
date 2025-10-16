//@ts-nocheck
import { Papel } from '@prisma/client';
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import xlsx from 'node-xlsx';
import { authenticator } from '~/secure/authentication.server';

export async function action({ request }: ActionFunctionArgs) {
  let usuario: Usuario = await authenticator.isAuthenticated(request, {
    failureRedirect: '/autentica/entrar',
  });

  if (usuario.papel != Papel.ADMIN) {
    return new Response(JSON.stringify({ "message": "Permissão negada." }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  let { body } = request

  var buffer = xlsx.build([{ name: 'Testes', data: body }]);

  

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/xlsx',
    },
  });
}
