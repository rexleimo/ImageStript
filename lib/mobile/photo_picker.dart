import 'dart:io';
import 'package:image_picker/image_picker.dart';

class MobilePhotoPicker {
  final ImagePicker _picker = ImagePicker();

  Future<List<File>> pickFromGallery({bool multiple = true}) async {
    final images = await _picker.pickMultiImage();
    return images.map((x) => File(x.path)).toList();
  }

  Future<File?> pickFromCamera() async {
    final image = await _picker.pickImage(source: ImageSource.camera);
    return image != null ? File(image.path) : null;
  }
}
