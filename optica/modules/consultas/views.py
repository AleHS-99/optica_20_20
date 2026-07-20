# modules/consultas/views.py
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from django.views.generic import TemplateView
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.db.models import Q
from modules.paciente.forms import pacienteForm
from modules.paciente.models import Paciente
from .models import consultaModel
from .forms import consultaForm

class AddConsultaView(LoginRequiredMixin, TemplateView):
    template_name = "consultas/add_consulta.html"
    
    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['clinica'] = True
        context['form'] = pacienteForm()
        context['title'] = 'Nueva Consulta'
        return context
    
    def post(self, request, *args, **kwargs):
        action = request.POST.get('action', '')
        
        if action == 'verificar_ci':
            return self.verificar_ci(request)
        
        elif action == 'guardar_paciente':
            return self.guardar_paciente(request)
        
        elif action == 'guardar_consulta':
            return self.guardar_consulta(request)
        
        elif action == 'searchdata':
            return self.searchdata(request)
        
        elif action == 'eliminar_consulta':
            return self.eliminar_consulta(request)
        
        return JsonResponse({'error': 'Acción no válida'}, status=400)
    
    def verificar_ci(self, request):
        ci = request.POST.get('ci', '').strip()
        
        if not ci or len(ci) != 11:
            return JsonResponse({
                'exists': False,
                'error': 'CI inválido'
            })
        
        try:
            paciente = Paciente.objects.get(ci=ci)
            data = {
                'exists': True,
                'paciente': {
                    'id': paciente.id,
                    'ci': paciente.ci,
                    'nombre': paciente.nombre,
                    'apell1': paciente.apell1,
                    'apell2': paciente.apell2,
                    'telefono': str(paciente.telefono) if paciente.telefono else '',
                    'direccion': paciente.direccion or ''
                }
            }
            return JsonResponse(data)
            
        except Paciente.DoesNotExist:
            return JsonResponse({'exists': False})
    
    def guardar_paciente(self, request):
        form = pacienteForm(request.POST)
        
        if form.is_valid():
            paciente = form.save()
            new_paciente = Paciente.objects.las()
            return JsonResponse({
                'success': True,
                'paciente_id': new_paciente.id,
                'message': 'Paciente guardado correctamente'
            })
        else:
            errors = {}
            for field, error_list in form.errors.items():
                errors[field] = error_list[0]
            return JsonResponse({
                'success': False,
                'errors': errors
            })
    
    def guardar_consulta(self, request):
        paciente_id = request.POST.get('paciente_id')
        if not paciente_id:
            return JsonResponse({
                'success': False,
                'error': 'ID de paciente no proporcionado'
            })
        
        paciente = get_object_or_404(Paciente, id=paciente_id)
        form = consultaForm(request.POST)
        
        if form.is_valid():
            consulta = form.save(commit=False)
            print(consulta)
            consulta.paciente = paciente
            consulta.save()
            
            return JsonResponse({
                'success': True,
                'consulta_id': consulta.id,
                'message': 'Consulta guardada correctamente'
            })
        else:
            errors = {}
            for field, error_list in form.errors.items():
                errors[field] = error_list[0]
            return JsonResponse({
                'success': False,
                'errors': errors
            })
    
    def searchdata(self, request):
        paciente_id = request.POST.get('paciente_id')
        
        if not paciente_id:
            return JsonResponse({
                'data': [],
                'error': 'No se ha seleccionado un paciente'
            })
        
        try:
            # Obtener las últimas 5 consultas del paciente
            consultas = consultaModel.objects.filter(
                paciente_id=paciente_id
            )[:5]
            
            # Obtener la primera consulta (más reciente) para verificar si es del día
            primera_consulta = consultaModel.objects.filter(
                paciente_id=paciente_id
            ).first()
            
            data = []
            for idx, consulta in enumerate(consultas):
                es_ultima = (idx == 0)  # La primera es la más reciente
                es_hoy = consulta.es_hoy
                
                data.append({
                    'id': consulta.id,
                    'created': consulta.created.isoformat() if consulta.created else None,
                    'refraccion': consulta.refraccion or '',
                    'ojo_derecho': consulta.ojo_derecho or '',
                    'ojo_izquierdo': consulta.ojo_izquierdo or '',
                    'add': consulta.add or '',
                    'es_hoy': es_hoy,
                    'es_ultima': es_ultima,
                    'is_first': idx == 0
                })
            
            return JsonResponse({'data': data})
            
        except Exception as e:
            return JsonResponse({
                'data': [],
                'error': str(e)
            })
    
    def eliminar_consulta(self, request):
        consulta_id = request.POST.get('consulta_id')
        
        if not consulta_id:
            return JsonResponse({
                'success': False,
                'error': 'ID de consulta no proporcionado'
            })
        
        try:
            consulta = consultaModel.objects.get(id=consulta_id)
            
            # Verificar que sea del día actual
            if not consulta.es_hoy:
                return JsonResponse({
                    'success': False,
                    'error': 'Solo se pueden eliminar consultas del día actual'
                })
            
            # Verificar que sea la última consulta
            ultima_consulta = consultaModel.objects.filter(
                paciente=consulta.paciente
            ).first()
            
            if ultima_consulta.id != consulta.id:
                return JsonResponse({
                    'success': False,
                    'error': 'Solo se puede eliminar la última consulta'
                })
            
            consulta.delete()
            
            return JsonResponse({
                'success': True,
                'message': 'Consulta eliminada correctamente'
            })
            
        except consultaModel.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Consulta no encontrada'
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            })