import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

type Empresa = {
	id: string;
	nome_fantasia: string;
	logo_url: string | null;
};

export default function Menu() {
	const { empresaId, mesaId } = useParams<{ empresaId: string; mesaId: string }>();
	const [empresa, setEmpresa] = useState<Empresa | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchData = async () => {
			const { data: emp } = await supabase.from('empresas').select('*').eq('id', empresaId).single();
			setEmpresa(emp);
			setIsLoading(false);
		};
		fetchData();
	}, [empresaId]);

	if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

	return (
		<div className="min-h-screen bg-gray-50 pb-32">
			<header className="bg-green-600 text-white p-4 sticky top-0 z-10">
				<h1 className="text-xl font-bold">{empresa?.nome_fantasia}</h1>
				<p>Mesa {mesaId}</p>
			</header>
			<main className="p-4 space-y-4">
				{/* Menu limpo. Adicione novamente o conteúdo do menu aqui. */}
			</main>
		</div>
	);

