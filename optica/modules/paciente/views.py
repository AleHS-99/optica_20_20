from django.views.generic import CreateView, ListView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.http import JsonResponse
from .models import Paciente
from .forms import pacienteForm
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.mixins import LoginRequiredMixin

# Create your views here.
class pacienteListView(LoginRequiredMixin, ListView):
    model = Paciente
    template_name = "pacientes/list.html"
    
    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['clinica'] = True
        context['create_url'] = reverse_lazy('pacientes:create')
        context['list_url'] = reverse_lazy('pacientes:list')
        context['title'] = "Listado de pacientes"
        return context

    def post(self, request, *args, **kwargs):
        data = {}
        try:
            action = request.POST['action']
            if action == 'searchdata':
                pacientes = Paciente.objects.all()
                data = []
                for p in pacientes:
                    data.append(p.toJSON())
            else:
                data['error'] = 'Ha ocurrido un error'
        except Exception as e:
            data['error'] = str(e)
        
        return JsonResponse(data=data, safe=False)
    
class addPacienteView(LoginRequiredMixin, CreateView):
    template_name = "bases/form_base.html"
    model = Paciente
    form_class = pacienteForm
    success_url = reverse_lazy("pacientes:list")
    
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = 'Añadir Paciente'
        context['list_url'] = self.success_url
        context['action'] = 'add'
        context['clinica'] = True
        return context

    def post(self, request, *args, **kwargs):
        data = {}
        try:
            action = request.POST['action']
            if action == 'add':
                form = self.get_form()
                data = form.save()
            else:
                data['error'] = "Ha ocurrido un error"
        except Exception as e:
            data['error'] = str(e)

        return JsonResponse(data=data, safe=False)

class editPacienteView(LoginRequiredMixin, UpdateView):
    template_name = 'bases/form_base.html'
    model = Paciente
    form_class = pacienteForm
    success_url = reverse_lazy('pacientes:list')
    
    def dispatch(self, request, *args, **kwargs):
        self.object = self.get_object()
        return super().dispatch(request, *args, **kwargs)
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['clinica'] = True
        context['list_url'] = self.success_url
        context['title'] = "Editar Paciente"
        context['action'] = 'edit'
        return context

    def post(self, request, *args,**kwargs):
        data = {}
        try:
            action=request.POST['action']
            if action=='edit':
                form=self.get_form()
                data = form.save()
            else:
                data['error']='No ha ingresado a ninguna opción'
        except Exception as e:
            data['error']=str(e)
        
        return JsonResponse(data)
    
class deletePacienteView(LoginRequiredMixin, DeleteView):
    model = Paciente
    template_name = "bases/delete.html"
    success_url = reverse_lazy("pacientes:list")
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        paciente = self.get_object()
        context ['mensaje'] = f"¿Estas seguro de querer eliminar al paciente: {paciente.nombre} {paciente.apell1} {paciente.apell2}?"
        context['title'] = "Eliminar"
        context['list_url']=self.success_url
        context['clinica'] = True
        return context   