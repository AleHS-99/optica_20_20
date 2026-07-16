from django.forms import *
from .models import Paciente


class pacienteForm(ModelForm):
    class Meta:
        model = Paciente
        fields = '__all__'
        widgets = {
            'ci':TextInput(attrs={
                'placeholder': '12345678901',
                'pattern': '[0-9]{11}',
                'maxlength': '11',
                'minlength': '11',
            }),
            'nombre':TextInput(attrs={
                'placeholder':'Ingrese el nombre'
            }),
            'apell1':TextInput(attrs={
                'placeholder':'Ingrese el primer apellido'
            }),
            'apell2':TextInput(attrs={
                'placeholder':'Ingrese el segundo apellido'
            }),
            'direccion':Textarea(attrs={'placeholder':"Ingrese la dirección",'rows':3}),            
        }

    
    def save(self,commit=True):
        data = {}
        form = super()
        try:
            if form.is_valid():
                form.save()
            else:
                data['error'] = form.errors
        except Exception as e:
            data['error'] = str(e)
        return data